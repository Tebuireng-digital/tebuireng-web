import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ContentSkeleton } from '../components/LoadingSkeleton';
import { AppToast } from '../components/AppToast';
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

interface RentangNilaiItem {
    id?: number;
    huruf: string;
    min_nilai: number;
    max_nilai: number;
    predikat: string;
    urutan?: number;
}

export function UbudiyahMasterPage() {
    usePageMeta({
        title: 'Master Kriteria Pembinaan',
        description: 'Kelola kriteria penilaian ibadah dan pembinaan harian santri serta rentang nilai A–E.',
    });

    const queryClient = useQueryClient();

    // Active Tab: 'KRITERIA' | 'RENTANG_NILAI'
    const [activeTab, setActiveTab] = useState<'KRITERIA' | 'RENTANG_NILAI'>('KRITERIA');

    // Search and filter
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    // Modals state
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCriteriaName, setNewCriteriaName] = useState('');

    const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null);
    const [editCriteriaName, setEditCriteriaName] = useState('');

    // Rentang nilai state
    const [ranges, setRanges] = useState<RentangNilaiItem[]>([]);
    const [rangeError, setRangeError] = useState('');

    // Feedback
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [modalError, setModalError] = useState('');

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Fetch criteria list
    const { data: instruments = [], isLoading, isError, refetch } = useQuery<Instrument[]>({
        queryKey: ['ubudiyah-master'],
        queryFn: async () => (await api.get('/api/ubudiyah/master')).data,
    });

    // Fetch rentang nilai
    const { data: initialRanges = [], isLoading: isLoadingRanges, refetch: refetchRanges } = useQuery<RentangNilaiItem[]>({
        queryKey: ['rentang-nilai-pembinaan'],
        queryFn: async () => (await api.get('/api/rentang-nilai/pembinaan')).data,
        enabled: activeTab === 'RENTANG_NILAI',
    });

    useEffect(() => {
        if (initialRanges && initialRanges.length > 0) {
            setRanges(initialRanges.map(r => ({ ...r })));
        }
    }, [initialRanges]);

    // Add criteria mutation
    const addMutation = useMutation({
        mutationFn: async (nama: string) => {
            return (await api.post('/api/ubudiyah/master', { nama_instrumen: nama })).data;
        },
        onSuccess: () => {
            setShowAddModal(false);
            setNewCriteriaName('');
            setModalError('');
            showToast('Kriteria baru berhasil ditambahkan');
            void queryClient.invalidateQueries({ queryKey: ['ubudiyah-master'] });
        },
        onError: (err: any) => {
            setModalError(err.response?.data?.message || 'Gagal menambahkan kriteria.');
        }
    });

    // Update criteria name mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, nama }: { id: number; nama: string }) => {
            return (await api.put(`/api/ubudiyah/master/${id}`, { nama_instrumen: nama })).data;
        },
        onSuccess: () => {
            setEditingInstrument(null);
            setEditCriteriaName('');
            setModalError('');
            showToast('Nama kriteria berhasil diperbarui');
            void queryClient.invalidateQueries({ queryKey: ['ubudiyah-master'] });
        },
        onError: (err: any) => {
            setModalError(err.response?.data?.message || 'Gagal memperbarui kriteria.');
        }
    });

    // Toggle status mutation
    const toggleMutation = useMutation({
        mutationFn: async (id: number) => {
            return (await api.patch(`/api/ubudiyah/master/${id}/toggle`)).data;
        },
        onSuccess: () => {
            showToast('Status kriteria berhasil diperbarui');
            void queryClient.invalidateQueries({ queryKey: ['ubudiyah-master'] });
        },
        onError: (err: any) => {
            showToast(err.response?.data?.message || 'Gagal mengubah status', 'error');
        }
    });

    // Save rentang nilai mutation
    const saveRangesMutation = useMutation({
        mutationFn: async (items: RentangNilaiItem[]) => {
            return (await api.put('/api/rentang-nilai/pembinaan', { ranges: items })).data;
        },
        onSuccess: () => {
            setRangeError('');
            showToast('Rentang nilai A–E pembinaan berhasil disimpan');
            void queryClient.invalidateQueries({ queryKey: ['rentang-nilai-pembinaan'] });
        },
        onError: (err: any) => {
            setRangeError(err.response?.data?.message || 'Gagal menyimpan rentang nilai.');
        },
    });

    // Filtered instruments
    const filteredInstruments = useMemo(() => {
        return instruments.filter(item => {
            const matchesSearch = item.nama_instrumen.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus =
                statusFilter === 'all'
                    ? true
                    : statusFilter === 'active'
                    ? item.status_aktif
                    : !item.status_aktif;
            return matchesSearch && matchesStatus;
        });
    }, [instruments, searchQuery, statusFilter]);

    // Handlers
    const openAddModal = () => {
        setNewCriteriaName('');
        setModalError('');
        setShowAddModal(true);
    };

    const openEditModal = (inst: Instrument) => {
        setEditingInstrument(inst);
        setEditCriteriaName(inst.nama_instrumen);
        setModalError('');
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCriteriaName.trim()) return;
        addMutation.mutate(newCriteriaName.trim());
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingInstrument || !editCriteriaName.trim()) return;
        updateMutation.mutate({ id: editingInstrument.instrumen_id, nama: editCriteriaName.trim() });
    };

    const handleRangeChange = (index: number, field: keyof RentangNilaiItem, value: any) => {
        setRanges(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleSaveRanges = (e: React.FormEvent) => {
        e.preventDefault();
        for (const r of ranges) {
            if (Number(r.min_nilai) > Number(r.max_nilai)) {
                setRangeError(`Batas nilai untuk huruf ${r.huruf} tidak valid (min ${r.min_nilai} > max ${r.max_nilai}).`);
                return;
            }
        }
        saveRangesMutation.mutate(ranges);
    };

    return (
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 8px 48px 8px', background: 'transparent' }}>
            {/* Top Navigation Back */}
            <div style={{ marginBottom: '14px' }}>
                <Link
                    to="/ubudiyah"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--tinta-muda, #64748b)',
                        textDecoration: 'none',
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                    Kembali ke Raport Pembinaan
                </Link>
            </div>

            {/* Page Header (CMS Style) */}
            <div className="cms-master-header">
                <div>
                    <span className="page-eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '11px', fontWeight: 700, color: 'var(--aksen, #0f6e56)' }}>
                        PENGATURAN MANAGEMENT
                    </span>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '4px 0 6px 0' }}>
                        Master Kriteria Pembinaan
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                        Kelola kriteria metrik penilaian ibadah dan pembinaan harian santri serta rentang nilai A–E.
                    </p>
                </div>

                {activeTab === 'KRITERIA' && (
                    <button
                        type="button"
                        onClick={openAddModal}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            height: '40px',
                            padding: '0 18px',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14" />
                            <path d="M12 5v14" />
                        </svg>
                        Tambah Kriteria
                    </button>
                )}
            </div>

            {/* Tab Navigation (Kriteria vs Rentang Nilai) */}
            <div
                style={{
                    display: 'flex',
                    gap: '8px',
                    borderBottom: '1px solid #cbd5e1',
                    marginBottom: '20px',
                }}
            >
                <button
                    type="button"
                    onClick={() => setActiveTab('KRITERIA')}
                    style={{
                        padding: '10px 18px',
                        border: 'none',
                        borderBottom: activeTab === 'KRITERIA' ? '2px solid #2563eb' : '2px solid transparent',
                        background: 'transparent',
                        fontWeight: activeTab === 'KRITERIA' ? 700 : 500,
                        color: activeTab === 'KRITERIA' ? '#2563eb' : '#64748b',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    Daftar Kriteria Pembinaan
                    <span
                        style={{
                            backgroundColor: activeTab === 'KRITERIA' ? '#dbeafe' : '#f1f5f9',
                            color: activeTab === 'KRITERIA' ? '#1e40af' : '#64748b',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                        }}
                    >
                        {instruments.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('RENTANG_NILAI')}
                    style={{
                        padding: '10px 18px',
                        border: 'none',
                        borderBottom: activeTab === 'RENTANG_NILAI' ? '2px solid #2563eb' : '2px solid transparent',
                        background: 'transparent',
                        fontWeight: activeTab === 'RENTANG_NILAI' ? 700 : 500,
                        color: activeTab === 'RENTANG_NILAI' ? '#2563eb' : '#64748b',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    Rentang Nilai (A–E)
                    <span
                        style={{
                            backgroundColor: activeTab === 'RENTANG_NILAI' ? '#dbeafe' : '#f1f5f9',
                            color: activeTab === 'RENTANG_NILAI' ? '#1e40af' : '#64748b',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                        }}
                    >
                        5 Huruf
                    </span>
                </button>
            </div>

            {/* Toast Notification */}
            {toast && (
                <AppToast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Main CMS Card for Kriteria */}
            {activeTab === 'KRITERIA' && (
                <div className="cms-master-card" style={{ border: '1px solid #cbd5e1', borderRadius: '12px', background: '#ffffff', overflow: 'hidden' }}>
                    {/* Toolbar: Search & Filter */}
                    <div className="cms-master-toolbar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <div className="cms-search-wrapper">
                                <svg className="cms-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.3-4.3" />
                                </svg>
                                <input
                                    type="text"
                                    className="cms-search-input"
                                    placeholder="Cari nama kriteria..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('all')}
                                    style={{
                                        border: 'none',
                                        padding: '6px 14px',
                                        borderRadius: '6px',
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        backgroundColor: statusFilter === 'all' ? '#0f6e56' : '#e2e8f0',
                                        color: statusFilter === 'all' ? '#ffffff' : '#334155',
                                    }}
                                >
                                    Semua ({instruments.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('active')}
                                    style={{
                                        border: 'none',
                                        padding: '6px 14px',
                                        borderRadius: '6px',
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        backgroundColor: statusFilter === 'active' ? '#0f6e56' : '#e2e8f0',
                                        color: statusFilter === 'active' ? '#ffffff' : '#334155',
                                    }}
                                >
                                    Aktif ({instruments.filter(i => i.status_aktif).length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('inactive')}
                                    style={{
                                        border: 'none',
                                        padding: '6px 14px',
                                        borderRadius: '6px',
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        backgroundColor: statusFilter === 'inactive' ? '#0f6e56' : '#e2e8f0',
                                        color: statusFilter === 'inactive' ? '#ffffff' : '#334155',
                                    }}
                                >
                                    Nonaktif ({instruments.filter(i => !i.status_aktif).length})
                                </button>
                            </div>
                        </div>

                        <div style={{ fontSize: '13px', color: '#64748b' }}>
                            Menampilkan <strong>{filteredInstruments.length}</strong> dari {instruments.length} kriteria
                        </div>
                    </div>

                    {/* Table Content */}
                    {isLoading ? (
                        <div style={{ padding: '24px' }}>
                            <ContentSkeleton rows={5} />
                        </div>
                    ) : isError ? (
                        <div style={{ padding: '32px', textAlign: 'center' }}>
                            <p style={{ color: '#b91c1c', marginBottom: '12px' }}>
                                Gagal memuat kriteria. Silakan periksa koneksi lalu coba lagi.
                            </p>
                            <button type="button" className="secondary-button" onClick={() => void refetch()}>
                                Coba Lagi
                            </button>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="cms-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '60px', textAlign: 'center' }}>No</th>
                                        <th>Nama Kriteria Penilaian</th>
                                        <th style={{ width: '180px' }}>Dibuat Oleh</th>
                                        <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
                                        <th style={{ width: '200px', textAlign: 'center' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInstruments.map((inst, index) => (
                                        <tr key={inst.instrumen_id}>
                                            <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 500 }}>
                                                {index + 1}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
                                                    {inst.nama_instrumen}
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ color: '#475569', fontSize: '13px' }}>
                                                    {inst.pembuat?.nama || 'System Admin'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`cms-badge ${inst.status_aktif ? 'active' : 'inactive'}`}>
                                                    {inst.status_aktif ? 'Aktif' : 'Nonaktif'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div className="cms-action-group">
                                                    {/* Edit Name Button (Solid Blue, White text, No Outline) */}
                                                    <button
                                                        type="button"
                                                        className="cms-btn-action edit"
                                                        onClick={() => openEditModal(inst)}
                                                        title={`Ubah nama ${inst.nama_instrumen}`}
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                                            <path d="m15 5 4 4" />
                                                        </svg>
                                                        Ubah
                                                    </button>

                                                    {/* Status Toggle Button (Solid Red / Green, White text, No Outline) */}
                                                    <button
                                                        type="button"
                                                        className={`cms-btn-action ${inst.status_aktif ? 'deactivate' : 'activate'}`}
                                                        onClick={() => toggleMutation.mutate(inst.instrumen_id)}
                                                        title={inst.status_aktif ? 'Nonaktifkan kriteria' : 'Aktifkan kriteria'}
                                                    >
                                                        {inst.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {filteredInstruments.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
                                                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                                    {searchQuery ? 'Tidak ada kriteria yang sesuai pencarian.' : 'Belum ada kriteria penilaian terdaftar.'}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: RENTANG NILAI A-E */}
            {activeTab === 'RENTANG_NILAI' && (
                <div className="cms-master-card" style={{ border: '1px solid #cbd5e1', borderRadius: '12px', background: '#ffffff', overflow: 'hidden', padding: '24px' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
                            Konfigurasi Rentang Nilai A–E (Pembinaan)
                        </h2>
                        <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
                            Atur batas nilai minimum, maksimum, dan predikat resmi untuk setiap huruf kategori penilaian pembinaan harian santri.
                        </p>
                    </div>

                    {rangeError && (
                        <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#b91c1c', fontSize: '13px' }}>
                            {rangeError}
                        </div>
                    )}

                    {isLoadingRanges ? (
                        <ContentSkeleton rows={7} />
                    ) : (
                        <form onSubmit={handleSaveRanges}>
                            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                                <table className="cms-table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '100px', textAlign: 'center' }}>Nilai Huruf</th>
                                            <th style={{ width: '160px', textAlign: 'center' }}>Batas Min (0–100)</th>
                                            <th style={{ width: '160px', textAlign: 'center' }}>Batas Max (0–100)</th>
                                            <th>Predikat / Keterangan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ranges.map((row, idx) => (
                                            <tr key={row.huruf || idx}>
                                                <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                                                    {row.huruf}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={row.min_nilai}
                                                        onChange={e => handleRangeChange(idx, 'min_nilai', Number(e.target.value))}
                                                        style={{
                                                            width: '90px',
                                                            textAlign: 'center',
                                                            padding: '6px 10px',
                                                            border: '1px solid #cbd5e1',
                                                            borderRadius: '6px',
                                                            fontSize: '13.5px',
                                                            fontWeight: 600,
                                                        }}
                                                        required
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={row.max_nilai}
                                                        onChange={e => handleRangeChange(idx, 'max_nilai', Number(e.target.value))}
                                                        style={{
                                                            width: '90px',
                                                            textAlign: 'center',
                                                            padding: '6px 10px',
                                                            border: '1px solid #cbd5e1',
                                                            borderRadius: '6px',
                                                            fontSize: '13.5px',
                                                            fontWeight: 600,
                                                        }}
                                                        required
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={row.predikat}
                                                        onChange={e => handleRangeChange(idx, 'predikat', e.target.value)}
                                                        placeholder="Contoh: Sangat Baik / Mumtaz"
                                                        style={{
                                                            width: '100%',
                                                            padding: '6px 12px',
                                                            border: '1px solid #cbd5e1',
                                                            borderRadius: '6px',
                                                            fontSize: '13.5px',
                                                            boxSizing: 'border-box',
                                                        }}
                                                        required
                                                    />
                                                </td>
                                            </tr>
                                        ))}

                                        {ranges.length === 0 && (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                                                    Tidak ada konfigurasi rentang nilai yang ditemukan.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => void refetchRanges()}
                                    disabled={saveRangesMutation.isPending}
                                    style={{
                                        padding: '8px 18px',
                                        fontSize: '13.5px',
                                        fontWeight: 600,
                                        color: '#334155',
                                        backgroundColor: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Reset / Muat Ulang
                                </button>
                                <button
                                    type="submit"
                                    disabled={saveRangesMutation.isPending || ranges.length === 0}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 22px',
                                        fontSize: '13.5px',
                                        fontWeight: 600,
                                        color: '#ffffff',
                                        backgroundColor: '#0f6e56',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: saveRangesMutation.isPending ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    }}
                                >
                                    {saveRangesMutation.isPending ? 'Menyimpan...' : 'Simpan Rentang Nilai'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* =========================================================
                MODAL 1: TAMBAH KRITERIA BARU
               ========================================================= */}
            {showAddModal && (
                <div className="cms-modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="cms-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="cms-modal-header">
                            <h2 className="cms-modal-title">Tambah Kriteria Baru</h2>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddSubmit}>
                            <div className="cms-modal-body">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                    Nama Kriteria Penilaian <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Contoh: Membaca Sholawat Nariyah"
                                    value={newCriteriaName}
                                    onChange={e => setNewCriteriaName(e.target.value)}
                                    disabled={addMutation.isPending}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        fontSize: '14px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                    required
                                />

                                {modalError && (
                                    <div style={{ marginTop: '12px', padding: '8px 12px', background: '#dc2626', color: '#ffffff', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500 }}>
                                        {modalError}
                                    </div>
                                )}
                            </div>
                            <div className="cms-modal-footer">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    style={{
                                        padding: '8px 16px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: '#ffffff',
                                        background: '#64748b',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={addMutation.isPending || !newCriteriaName.trim()}
                                    style={{
                                        padding: '8px 18px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: '#ffffff',
                                        backgroundColor: '#2563eb',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: addMutation.isPending ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {addMutation.isPending ? 'Menyimpan...' : 'Simpan Kriteria'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================
                MODAL 2: UBAH / GANTI NAMA METRIK (REQUEST USER)
               ========================================================= */}
            {editingInstrument && (
                <div className="cms-modal-overlay" onClick={() => setEditingInstrument(null)}>
                    <div className="cms-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="cms-modal-header">
                            <h2 className="cms-modal-title">Ganti Nama Kriteria</h2>
                            <button
                                type="button"
                                onClick={() => setEditingInstrument(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit}>
                            <div className="cms-modal-body">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                    Nama Kriteria Penilaian <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Masukkan nama kriteria..."
                                    value={editCriteriaName}
                                    onChange={e => setEditCriteriaName(e.target.value)}
                                    disabled={updateMutation.isPending}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        fontSize: '14px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                    required
                                />

                                {modalError && (
                                    <div style={{ marginTop: '12px', padding: '8px 12px', background: '#dc2626', color: '#ffffff', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500 }}>
                                        {modalError}
                                    </div>
                                )}
                            </div>
                            <div className="cms-modal-footer">
                                <button
                                    type="button"
                                    onClick={() => setEditingInstrument(null)}
                                    style={{
                                        padding: '8px 16px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: '#ffffff',
                                        background: '#64748b',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={updateMutation.isPending || !editCriteriaName.trim()}
                                    style={{
                                        padding: '8px 18px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: '#ffffff',
                                        backgroundColor: '#2563eb',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {updateMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
