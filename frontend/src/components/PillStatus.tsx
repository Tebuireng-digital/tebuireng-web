import { useRef, useState } from 'react';

export type StatusAbsensi = 'Hadir' | 'Izin' | 'Sakit' | 'Alpha' | 'Terlambat';

const CYCLE_ORDER: StatusAbsensi[] = ['Hadir', 'Izin', 'Sakit', 'Alpha', 'Terlambat'];

interface PillStatusProps {
  status: StatusAbsensi;
  onChange: (newStatus: StatusAbsensi) => void;
  onLongPress: () => void;
}

export function PillStatus({ status, onChange, onLongPress }: PillStatusProps) {
  const timerRef = useRef<number | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const getBackgroundColor = (s: StatusAbsensi) => {
    switch (s) {
      case 'Hadir': return 'var(--status-hadir)';
      case 'Izin': return 'var(--status-izin)';
      case 'Sakit': return 'var(--status-sakit)';
      case 'Alpha': return 'var(--status-alpha)';
      case 'Terlambat': return 'var(--status-terlambat)';
      default: return 'var(--status-hadir)';
    }
  };

  const handlePointerDown = () => {
    setIsPressed(true);
    timerRef.current = window.setTimeout(() => {
      onLongPress();
      setIsPressed(false);
      timerRef.current = null;
    }, 600); // 600ms hold for long press
  };

  const handlePointerUp = () => {
    if (timerRef.current !== null) {
      // It was a short tap
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setIsPressed(false);
      
      const currentIndex = CYCLE_ORDER.indexOf(status);
      const nextIndex = (currentIndex + 1) % CYCLE_ORDER.length;
      onChange(CYCLE_ORDER[nextIndex]);
    }
  };

  const handlePointerLeave = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setIsPressed(false);
    }
  };

  return (
    <button
      className="pill-status ui-text-label"
      style={{
        backgroundColor: getBackgroundColor(status),
        opacity: isPressed ? 0.8 : 1,
        // Calculate contrast color: WCAG AA check
        // These background colors are generally dark enough for white text. 
        // We will test contrast later.
        color: '#FFFFFF' 
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => e.preventDefault()} // Prevent native context menu on long press on some devices
    >
      {status}
    </button>
  );
}
