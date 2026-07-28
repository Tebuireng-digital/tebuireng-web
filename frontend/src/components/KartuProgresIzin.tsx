

export interface TahapApproval {
  tahap: number;
  jabatan_approver: string;
  nama_pemutus?: string; // Boleh null jika belum disetujui
  keputusan: 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Gugur';
  waktu_keputusan?: string;
}

interface KartuProgresIzinProps {
  tahapan: TahapApproval[];
}

export function KartuProgresIzin({ tahapan }: KartuProgresIzinProps) {
  return (
    <div style={{
      backgroundColor: 'var(--kertas-kartu)',
      border: '1px solid var(--garis)',
      padding: '24px',
      borderRadius: '8px'
    }}>
      <h3 className="ui-text-title" style={{ marginBottom: '24px' }}>Lembar Disposisi Izin</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {tahapan.map((t, index) => {
          const isLast = index === tahapan.length - 1;
          const isPassed = t.keputusan === 'Disetujui' || t.keputusan === 'Ditolak';
          
          return (
            <div key={t.tahap} style={{ display: 'flex' }}>
              {/* Kolom Garis */}
              <div style={{ 
                width: '32px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center' 
              }}>
                {/* Kita tidak pakai bulatan/stepper, cukup garis lurus yang putus jika menunggu */}
                <div style={{ 
                  flex: 1, 
                  borderLeft: isPassed ? '2px solid var(--garis)' : '2px dashed var(--garis)',
                  opacity: isLast ? 0 : 1, // Sembunyikan garis setelah elemen terakhir
                  minHeight: '64px',
                  marginTop: '12px' // Memberi ruang teks
                }} />
              </div>
              
              {/* Kolom Konten */}
              <div style={{ flex: 1, paddingBottom: '24px' }}>
                <div className="ui-text-name">{t.jabatan_approver}</div>
                
                {t.keputusan !== 'Menunggu' && t.keputusan !== 'Gugur' ? (
                  <div style={{ marginTop: '4px' }}>
                    <div className="ui-text-body" style={{ color: 'var(--tinta)' }}>
                      {t.nama_pemutus || 'Sistem'} ({t.keputusan})
                    </div>
                    {t.waktu_keputusan && (
                      <div className="ui-text-tabular" style={{ fontSize: '12px', marginTop: '2px' }}>
                        {t.waktu_keputusan}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="ui-text-body" style={{ color: 'var(--tinta-pudar)', marginTop: '4px', fontStyle: 'italic' }}>
                    {t.keputusan}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
