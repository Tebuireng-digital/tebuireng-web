import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

interface PrestasiRecord {
  prestasi_id: number;
  santri_id: number;
  nama_santri: string;
  nis: string | null;
  nama_prestasi: string;
  peringkat?: string | null;
  tingkat?: string | null;
  tanggal: string;
  keterangan?: string | null;
}

export function PrestasiListPage() {
  const [searchParams] = useSearchParams();
  const [prestasiList, setPrestasiList] = useState<PrestasiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const selectedSantriId = searchParams.get('santri_id');

  usePageMeta({
    title: 'Daftar Prestasi Santri',
    description: 'Daftar prestasi dan penghargaan santri Pondok Pesantren Tebuireng.',
  });

  useEffect(() => {
    const fetchPrestasi = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/api/prestasi', {
          params: selectedSantriId ? { santri_id: selectedSantriId } : undefined,
        });
        setPrestasiList(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Gagal memuat data prestasi.');
      } finally {
        setLoading(false);
      }
    };

    fetchPrestasi();
  }, [selectedSantriId]);

  const filteredPrestasi = useMemo(() => {
    const query = search.trim().toLowerCase();
    return prestasiList.filter(item => {
      const matchesSearch = !query || [item.nama_santri, item.nama_prestasi, item.keterangan ?? '']
        .some(value => value.toLowerCase().includes(query));
      const matchesStart = !startDate || item.tanggal >= startDate;
      const matchesEnd = !endDate || item.tanggal <= endDate;
      return matchesSearch && matchesStart && matchesEnd;
    });
  }, [prestasiList, search, startDate, endDate]);

  if (loading) return <PageSkeleton />;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div className="pelanggaran-list-page">
      <header className="dashboard-header" style={{ marginBottom: 20 }}>
        <div style={{ width: '100%' }}>
          <span className="page-eyebrow">Rekap Santri</span>
          <h1>Daftar Prestasi Santri</h1>
          <p>Rekam prestasi, kejuaraan, dan penghargaan santri Pondok Pesantren Tebuireng.</p>
        </div>
      </header>

      <section className="master-section" aria-labelledby="prestasi-table-title">
        <h2 id="prestasi-table-title" className="sr-only">Daftar prestasi santri</h2>
        <div className="account-table-controls">
          <div className="account-search-control">
            <label htmlFor="search-prestasi">Pencarian Prestasi</label>
            <input
              id="search-prestasi"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Cari nama santri, lomba, kejuaraan..."
            />
          </div>
          <div>
            <label htmlFor="filter-dari-prestasi">Dari Tanggal</label>
            <input type="date" id="filter-dari-prestasi" value={startDate} onChange={event => setStartDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="filter-sampai-prestasi">Sampai Tanggal</label>
            <input type="date" id="filter-sampai-prestasi" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </div>
        </div>

        <p className="account-result-count">
          Menampilkan {filteredPrestasi.length} dari {prestasiList.length} rekam prestasi santri.
        </p>

        <div className="table-scroll prestasi-table-scroll">
          <table className="master-table prestasi-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>Nama Santri</th>
                <th>Judul Prestasi / Kejuaraan</th>
                <th>Peringkat / Penghargaan</th>
                <th>Tingkat</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrestasi.map((item, index) => (
                <tr key={item.prestasi_id}>
                  <td data-label="No">{index + 1}</td>
                  <td data-label="Tanggal"><strong>{item.tanggal}</strong></td>
                  <td data-label="Nama Santri"><strong>{item.nama_santri}</strong></td>
                  <td data-label="Prestasi"><strong className="prestasi-title">{item.nama_prestasi}</strong></td>
                  <td data-label="Peringkat / Penghargaan">
                    <span className="prestasi-rank">{item.peringkat || 'Juara'}</span>
                  </td>
                  <td data-label="Tingkat">{item.tingkat || 'Tebuireng'}</td>
                  <td data-label="Keterangan">{item.keterangan || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPrestasi.length === 0 && (
            <div className="empty-state">Belum ada data prestasi yang sesuai dengan pencarian.</div>
          )}
        </div>
      </section>
    </div>
  );
}
