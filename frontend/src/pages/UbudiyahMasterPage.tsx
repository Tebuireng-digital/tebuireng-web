import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import { ContentSkeleton } from '../components/LoadingSkeleton';
import { usePageMeta } from '../hooks/usePageMeta';

interface Instrument {
    instrumen_id: number;
    nama_instrumen: string;
    status_aktif: boolean;
    pembuat?: {
        nama: string;
    };
    created_at: string;
}

export function UbudiyahMasterPage() {
    usePageMeta({
        title: 'Master Kriteria Ubudiyah',
        description: 'Kelola kriteria penilaian ibadah harian (Ubudiyah Yaumiyah) santri.',
    });

    const queryClient = useQueryClient();
    const [newCriteria, setNewCriteria] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Fetch criteria list
    const { data: instruments = [], isLoading, isError, refetch } = useQuery<Instrument[]>({
        queryKey: ['ubudiyah-master'],
        queryFn: async () => (await api.get('/api/ubudiyah/master')).data,
    });

    // Add criteria mutation
    const addMutation = useMutation({
        mutationFn: async (nama: string) => {
            return (await api.post('/api/ubudiyah/master', { nama_instrumen: nama })).data;
        },
        onSuccess: () => {
            setNewCriteria('');
            setErrorMessage('');
            void queryClient.invalidateQueries({ queryKey: ['ubudiyah-master'] });
        },
        onError: (err: any) => {
            setErrorMessage(err.response?.data?.message || 'Gagal menambahkan kriteria.');
        }
    });

    // Toggle criteria status mutation
    const toggleMutation = useMutation({
        mutationFn: async (id: number) => {
            return (await api.patch(`/api/ubudiyah/master/${id}/toggle`)).data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['ubudiyah-master'] });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCriteria.trim()) return;
        addMutation.mutate(newCriteria.trim());
    };

    return (
        <section className="app-container master-page">
            <div className="page-heading">
                <span className="page-eyebrow">Pengaturan Sistem</span>
                <h1>Master Kriteria Ubudiyah</h1>
                <p>Tambah, kurangi, atau aktifkan/nonaktifkan kriteria penilaian ibadah harian santri.</p>
            </div>

            <div className="stat-card" style={{ marginBottom: '24px', padding: '20px' }}>
                <h2 className="ui-text-title" style={{ fontSize: '16px', marginBottom: '12px' }}>Tambah Kriteria Baru</h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 300px' }}>
                        <input
                            type="text"
                            placeholder="Ketik nama kriteria (contoh: Membaca Sholawat Nariyah)..."
                            value={newCriteria}
                            onChange={e => setNewCriteria(e.target.value)}
                            disabled={addMutation.isPending}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--garis)' }}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="primary-button"
                        disabled={addMutation.isPending || !newCriteria.trim()}
                        style={{ padding: '10px 20px', height: 'auto' }}
                    >
                        {addMutation.isPending ? 'Menambahkan...' : 'Tambah Kriteria'}
                    </button>
                </form>
                {errorMessage && (
                    <div className="error-box" style={{ marginTop: '12px', padding: '8px 12px' }}>
                        {errorMessage}
                    </div>
                )}
            </div>

            {isLoading ? (
                <ContentSkeleton rows={5} />
            ) : isError ? (
                <div className="error-box">
                    Gagal memuat kriteria. Pastikan koneksi internet aktif.
                    <button type="button" className="secondary-button" onClick={() => void refetch()}>Coba lagi</button>
                </div>
            ) : (
                <div className="raport-table-wrapper" style={{ marginTop: '16px' }}>
                    <table className="raport-input-table ubudiyah-input-table">
                        <thead>
                            <tr>
                                <th style={{ width: '8%', textAlign: 'center' }}>No</th>
                                <th style={{ width: '42%', textAlign: 'left' }}>Nama Kriteria Penilaian</th>
                                <th style={{ width: '20%', textAlign: 'center' }}>Dibuat Oleh</th>
                                <th style={{ width: '15%', textAlign: 'center' }}>Status</th>
                                <th style={{ width: '15%', textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {instruments.map((inst, index) => (
                                <tr key={inst.instrumen_id} className={index % 2 === 0 ? '' : 'raport-row-alt'}>
                                    <td style={{ textAlign: 'center' }}>{index + 1}</td>
                                    <td style={{ textAlign: 'left', fontWeight: 600 }}>{inst.nama_instrumen}</td>
                                    <td style={{ textAlign: 'center', color: 'var(--tinta-muda)' }}>{inst.pembuat?.nama || 'System'}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className={`severity-badge ${inst.status_aktif ? 'severity-ringan' : 'severity-berat'}`} style={{ display: 'inline-block', width: '80px', textAlign: 'center' }}>
                                            {inst.status_aktif ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            className="secondary-button"
                                            onClick={() => toggleMutation.mutate(inst.instrumen_id)}
                                            style={{
                                                padding: '4px 10px',
                                                fontSize: '11px',
                                                backgroundColor: inst.status_aktif ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                color: inst.status_aktif ? 'var(--aksen-merah)' : 'var(--aksen)',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {inst.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {instruments.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="empty-state" style={{ padding: '32px' }}>
                                        Belum ada kriteria penilaian yang ditambahkan.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
