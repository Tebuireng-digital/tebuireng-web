const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;
const WA_API_KEY = process.env.WA_API_KEY || 'secret_key_bot_tebuireng';
const SESSIONS_DIR = path.join(__dirname, 'sessions');

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected'; // 'connecting', 'connected', 'disconnected'
let connectionError = null;

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

async function connectToWhatsApp() {
  connectionStatus = 'connecting';
  connectionError = null;

  const { state, saveCreds } = await useMultiFileAuthState(SESSIONS_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeData = qr;
      logger.info('New QR Code generated');
    }

    if (connection === 'close') {
      connectionStatus = 'disconnected';
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(`Connection closed due to: ${lastDisconnect?.error}, statusCode: ${statusCode}. Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 3000);
      } else {
        logger.error('Session logged out. Clearing sessions directory...');
        qrCodeData = null;
        try {
          if (fs.existsSync(SESSIONS_DIR)) {
            const files = fs.readdirSync(SESSIONS_DIR);
            for (const file of files) {
              fs.unlinkSync(path.join(SESSIONS_DIR, file));
            }
          }
        } catch (e) {
          logger.error('Failed clearing sessions: ' + e.message);
        }
        setTimeout(connectToWhatsApp, 2000);
      }
    } else if (connection === 'open') {
      connectionStatus = 'connected';
      qrCodeData = null;
      logger.info('WhatsApp connection established successfully!');
    }
  });
}

// Middleware Authentication API Key
function authenticateKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey || apiKey !== WA_API_KEY) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized. Invalid API Key.' });
  }
  next();
}

// Health Check & Status
app.get('/status', (req, res) => {
  if (connectionStatus === 'disconnected' && !sock) {
    connectToWhatsApp();
  }
  res.json({
    status: 'ok',
    wa_connection: connectionStatus,
    error: connectionError,
    timestamp: new Date().toISOString(),
  });
});

// Endpoint API JSON QR Code (Khusus dipanggil oleh Admin via Backend)
app.get('/qr-data', authenticateKey, async (req, res) => {
  if (connectionStatus !== 'connected' && !qrCodeData && !sock) {
    connectToWhatsApp();
  }

  let qrImage = null;
  if (qrCodeData && connectionStatus !== 'connected') {
    try {
      qrImage = await QRCode.toDataURL(qrCodeData);
    } catch (err) {
      logger.error('Error generating QR image: ' + err.message);
    }
  }

  let userPhone = null;
  if (connectionStatus === 'connected' && sock?.user) {
    userPhone = sock.user.id ? sock.user.id.split(':')[0] : null;
  }

  res.json({
    status: 'ok',
    wa_connection: connectionStatus,
    qr_image: qrImage,
    phone_number: userPhone,
    timestamp: new Date().toISOString(),
  });
});

// Endpoint Logout & Reset Session WA (Khusus dipanggil oleh Admin via Backend)
app.post('/disconnect', authenticateKey, async (req, res) => {
  try {
    logger.info('Disconnect requested by Admin. Clearing sessions...');
    connectionStatus = 'disconnected';
    qrCodeData = null;

    if (sock) {
      try {
        await sock.logout();
      } catch (e) {
        // ignore
      }
      sock.end(undefined);
      sock = null;
    }

    if (fs.existsSync(SESSIONS_DIR)) {
      const files = fs.readdirSync(SESSIONS_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(SESSIONS_DIR, file));
      }
    }

    // Reconnect to generate new QR Code
    setTimeout(connectToWhatsApp, 1000);

    return res.json({ status: 'success', message: 'Sesi WhatsApp berhasil diputuskan. QR Code baru sedang dibuat.' });
  } catch (err) {
    logger.error('Error disconnecting WA session: ' + err.message);
    return res.status(500).json({ status: 'error', message: 'Gagal memutuskan sesi WhatsApp: ' + err.message });
  }
});

// Direct public /qr access disabled for security
app.get('/qr', (req, res) => {
  res.status(403).send(`
    <!DOCTYPE html>
    <html>
      <head><title>Akses Dibatasi</title></head>
      <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #f8fafc; color: #1e293b;">
        <h2 style="color: #ef4444;">🔒 Akses Dibatasi</h2>
        <p>Penautan dan Pengaturan Bot WhatsApp hanya dapat dilakukan oleh <strong>Admin SIMANTEB</strong> melalui Dashboard Data Master.</p>
      </body>
    </html>
  `);
});

// Send WhatsApp Message API
app.post('/send-message', authenticateKey, async (req, res) => {
  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({
      status: 'error',
      message: 'WhatsApp Bot belum terhubung / belum dikaitkan via QR Code.',
      wa_connection: connectionStatus,
    });
  }

  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({
      status: 'error',
      message: 'Parameter "phone" dan "message" wajib diisi.',
    });
  }

  try {
    // Clean & Format Phone Number to Indonesian 62 format
    let cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    } else if (!cleanPhone.startsWith('62')) {
      cleanPhone = '62' + cleanPhone;
    }

    const jid = `${cleanPhone}@s.whatsapp.net`;

    const sentMsg = await sock.sendMessage(jid, { text: message });

    logger.info(`Message sent to ${cleanPhone}: ${sentMsg.key.id}`);

    return res.json({
      status: 'success',
      message: 'Pesan berhasil dikirim',
      message_id: sentMsg.key.id,
      to: cleanPhone,
    });
  } catch (err) {
    logger.error(`Error sending message to ${phone}: ${err.message}`);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengirim pesan WhatsApp',
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  logger.info(`WA Gateway Server running on port ${PORT}`);
  connectToWhatsApp();
});
