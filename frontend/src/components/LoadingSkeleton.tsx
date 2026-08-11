/**
 * Loading state components — skeleton placeholders and spinners.
 *
 * Replaces plain "Memuat..." text with visually polished feedback:
 * - Spinner: smooth rotating circle for inline/action loading
 * - PageSkeleton: full-page shimmer bars for initial page loads
 * - ContentSkeleton: inline shimmer rows for partial data loading
 * - ValuePulse: pulsing placeholder for numeric/stat values
 */

/** Smooth CSS-only circular spinner. */
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'sm' ? 16 : size === 'lg' ? 40 : 24;
  return (
    <span
      className={`spinner spinner--${size}`}
      role="status"
      aria-label="Memuat"
      style={{ width: px, height: px }}
    />
  );
}

/** Full-page skeleton with header bar + content rows shimmer. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="skeleton-page" role="status" aria-label="Memuat halaman">
      {/* Faux header block */}
      <div className="skeleton-header-group">
        <div className="skeleton-bar" style={{ width: '35%', height: 14 }} />
        <div className="skeleton-bar" style={{ width: '55%', height: 22 }} />
        <div className="skeleton-bar" style={{ width: '70%', height: 12 }} />
      </div>
      {/* Faux content rows */}
      <div className="skeleton-content-group">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="skeleton-bar"
            style={{
              width: `${60 + Math.round(Math.sin(i * 1.8) * 25)}%`,
              height: 14,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Inline content skeleton — a few shimmer bars for partial-area loading. */
export function ContentSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-content" role="status" aria-label="Memuat data">
      <Spinner size="md" />
      <div className="skeleton-content-rows">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="skeleton-bar"
            style={{
              width: `${55 + Math.round(Math.cos(i * 2) * 30)}%`,
              height: 12,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Pulsing short placeholder for numeric/stat values while loading. */
export function ValuePulse({ width = 36 }: { width?: number }) {
  return (
    <span
      className="value-pulse"
      role="status"
      aria-label="Memuat nilai"
      style={{ width, height: '1em' }}
    />
  );
}
