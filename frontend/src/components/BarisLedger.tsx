import { PillStatus } from './PillStatus';
import type { StatusAbsensi } from './PillStatus';

interface BarisLedgerProps {
  nomorUrut: number;
  nama: string;
  nis: string;
  status: StatusAbsensi;
  onChangeStatus: (newStatus: StatusAbsensi) => void;
  onLongPressStatus: () => void;
  isEven: boolean;
}

export function BarisLedger({
  nomorUrut,
  nama,
  nis,
  status,
  onChangeStatus,
  onLongPressStatus,
  isEven
}: BarisLedgerProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '56px',
        padding: '0 16px',
        backgroundColor: isEven ? 'var(--kertas)' : 'var(--kertas-kartu)',
      }}
    >
      <div 
        className="ui-text-tabular" 
        style={{ width: '40px', flexShrink: 0 }}
      >
        {nomorUrut}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="ui-text-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {nama}
        </div>
        <div className="ui-text-tabular" style={{ fontSize: '12px' }}>
          {nis}
        </div>
      </div>
      <div style={{ flexShrink: 0, marginLeft: '12px' }}>
        <PillStatus 
          status={status} 
          onChange={onChangeStatus} 
          onLongPress={onLongPressStatus} 
        />
      </div>
    </div>
  );
}
