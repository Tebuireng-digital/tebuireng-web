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
    <tr className={`ledger-row ${isEven ? 'ledger-row-even' : 'ledger-row-odd'}`}>
      <td className="ledger-cell-no ui-text-tabular">
        {nomorUrut}
      </td>
      <td className="ledger-cell-nama">
        <div className="ui-text-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {nama}
        </div>
        <div className="ui-text-tabular" style={{ fontSize: '12px', color: 'var(--tinta-pudar)' }}>
          {nis}
        </div>
      </td>
      <td className="ledger-cell-status">
        <PillStatus 
          status={status} 
          onChange={onChangeStatus} 
          onLongPress={onLongPressStatus} 
        />
      </td>
    </tr>
  );
}
