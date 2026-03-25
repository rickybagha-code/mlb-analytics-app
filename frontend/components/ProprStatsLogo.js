/**
 * ProprStatsLogo — home plate pentagon mark with optional wordmark.
 *
 * @param {{ variant?: 'light'|'dark', size?: number, showWordmark?: boolean, showSubLabel?: boolean, wordmarkClass?: string, className?: string }} props
 */
export default function ProprStatsLogo({
  variant = 'light',
  size = 32,
  showWordmark = true,
  showSubLabel = false,
  wordmarkClass = '',
  className = '',
}) {
  const fg = variant === 'dark' ? '#0f1117' : 'white';
  const bg = variant === 'dark' ? 'white' : '#0f1117';
  const wordmarkColorClass = variant === 'dark' ? 'text-[#0f1117]' : 'text-white';
  const subLabelColor = variant === 'dark' ? 'rgba(15,17,23,0.35)' : 'rgba(255,255,255,0.35)';
  const wordmarkFontSize = Math.round(size * 15 / 32);
  const subLabelFontSize = Math.max(8, Math.round(size * 9 / 32));

  return (
    <div
      className={`inline-flex items-center ${className}`}
      style={{ gap: showWordmark ? 10 : 0 }}
    >
      {/* ── Mark: home plate pentagon ── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Home plate pentagon: flat top, vertical sides, angled to bottom point */}
        <path d="M 7,8 L 49,8 L 49,36 L 28,52 L 7,36 Z" fill={fg}/>
        {/* "P" monogram centered in the plate */}
        <text
          x="28" y="34"
          textAnchor="middle"
          fontFamily="system-ui,-apple-system,sans-serif"
          fontSize="22"
          fontWeight="900"
          fill={bg}
        >P</text>
      </svg>

      {/* ── Wordmark + optional sub-label ── */}
      {showWordmark && (
        <div className="flex flex-col leading-none" style={{ gap: showSubLabel ? 3 : 0 }}>
          <span
            className={`${wordmarkColorClass} ${wordmarkClass}`}
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: wordmarkFontSize,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            ProprStats
          </span>
          {showSubLabel && (
            <span
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: subLabelFontSize,
                fontWeight: 400,
                letterSpacing: '0.2em',
                color: subLabelColor,
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              MLB Analytics
            </span>
          )}
        </div>
      )}
    </div>
  );
}
