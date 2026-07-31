export type SyncState = 'tersinkron' | 'menyinkronkan' | 'offline' | 'error';

interface IndikatorSinkronProps {
  state: SyncState;
}

export function IndikatorSinkron({ state }: IndikatorSinkronProps) {
  const labels: Record<SyncState, string> = {
    tersinkron: 'Tersinkron',
    menyinkronkan: 'Sedang menyimpan',
    offline: 'Belum tersinkron',
    error: 'Sinkronisasi gagal',
  };

  return (
    <div 
      className={`indikator-sinkron ${state}`}
      title={`Status sinkronisasi: ${labels[state]}`}
      role="status"
      aria-live="polite"
    ></div>
  );
}
