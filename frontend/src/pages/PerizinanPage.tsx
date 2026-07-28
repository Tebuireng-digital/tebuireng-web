import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { KartuProgresIzin } from '../components/KartuProgresIzin';
import type { TahapApproval } from '../components/KartuProgresIzin';

export function PerizinanPage() {
  const { santriId } = useParams();
  const [perizinan, setPerizinan] = useState<any>(null);
  const [tahapan, setTahapan] = useState<TahapApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPerizinan() {
      try {
        const res = await api.get(`/api/santri/${santriId}/perizinan`);
        if (res.data.length > 0) {
          const latest = res.data[0]; // Assuming the endpoint returns the latest one first, or we just take the first
          setPerizinan(latest);
          setTahapan(latest.approval_progress || []);
        }
      } catch (err) {
        console.error('Failed to fetch perizinan', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPerizinan();
  }, [santriId]);

  if (isLoading) return <div style={{ padding: '24px' }}>Memuat data perizinan...</div>;

  return (
    <div className="app-container" style={{ padding: '24px' }}>
      <h1 className="ui-text-title" style={{ marginBottom: '24px' }}>Detail Perizinan</h1>
      
      {perizinan ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ backgroundColor: 'var(--kertas-kartu)', padding: '24px', borderRadius: '8px', border: '1px solid var(--garis)' }}>
            <h2 className="ui-text-name" style={{ marginBottom: '8px' }}>Santri ID: {perizinan.santri_id}</h2>
            <p className="ui-text-body">Tanggal Mulai: {perizinan.tanggal_mulai}</p>
            <p className="ui-text-body">Rencana Kembali: {perizinan.rencana_kembali}</p>
            <p className="ui-text-body" style={{ marginTop: '8px' }}>Status Akhir: <strong>{perizinan.status}</strong></p>
          </div>

          <KartuProgresIzin tahapan={tahapan} />
        </div>
      ) : (
        <div className="ui-text-body">Belum ada riwayat perizinan aktif untuk santri ini.</div>
      )}
    </div>
  );
}
