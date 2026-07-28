export type SyncState = 'tersinkron' | 'offline' | 'error';

interface IndikatorSinkronProps {
  state: SyncState;
}

export function IndikatorSinkron({ state }: IndikatorSinkronProps) {
  return (
    <div 
      className={`indikator-sinkron ${state}`}
      title={`Status Sinkronisasi: ${state}`}
      role="status"
      aria-live="polite"
    ></div>
  );
}
