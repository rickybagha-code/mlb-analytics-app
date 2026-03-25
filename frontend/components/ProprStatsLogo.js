/**
 * ProprStatsLogo — ascending bars + trend arrow mark with optional wordmark.
 *
 * @param {{ variant?: 'light'|'dark', size?: number, showWordmark?: boolean, showSubLabel?: boolean, className?: string }} props
 *   variant      'light' = white mark on dark bg (default); 'dark' = #0f1117 mark on light bg
 *   size         height in px; mark is square so width === size (default 32)
 *   showWordmark whether to render "ProprStats" wordmark beside mark (default true)
 *   showSubLabel whether to render "MLB Analytics" sub-label below wordmark (default false)
 *   className    extra CSS classes on the wrapper element
 */
export default function ProprStatsLogo({
  variant = 'light',
  size = 32,
  showWordmark = true,
  showSubLabel = false,
  className = '',
}) {
  const fg = variant === 'dark' ? '#0f1117' : 'white';
  const wordmarkColor = variant === 'dark' ? '#0f1117' : 'white';
  const subLabelColor = variant === 'dark' ? 'rgba(15,17,23,0.35)' : 'rgba(255,255,255,0.35)';

  // Scale wordmark font relative to mark size; match nav spec (15px at size=32)
  const wordmarkFontSize = Math.round(size * 15 / 32);
  const subLabelFontSize = Math.max(8, Math.round(size * 9 / 32));

  return (
    <div
      className={`inline-flex items-center ${className}`}
      style={{ gap: showWordmark ? 10 : 0 }}
    >
      {/* ── Mark: ascending bars + trend arrow in a 56×56 coordinate system ── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Bar 1 — shortest */}
        <path d="M6 42 L12 42 Q14 42 14 44 L14 52 L4 52 L4 44 Q4 42 6 42 Z" fill={fg}/>
        {/* Bar 2 */}
        <path d="M19 32 L25 32 Q27 32 27 34 L27 52 L17 52 L17 34 Q17 32 19 32 Z" fill={fg}/>
        {/* Bar 3 */}
        <path d="M32 20 L38 20 Q40 20 40 22 L40 52 L30 52 L30 22 Q30 20 32 20 Z" fill={fg}/>
        {/* Bar 4 — tallest */}
        <path d="M45 8 L51 8 Q53 8 53 10 L53 52 L43 52 L43 10 Q43 8 45 8 Z" fill={fg}/>
        {/* Trend arrow diagonal line */}
        <line x1="4" y1="44" x2="50" y2="10" stroke={fg} strokeWidth="2.5" strokeLinecap="round"/>
        {/* Arrowhead chevron */}
        <line x1="50" y1="10" x2="44" y2="14" stroke={fg} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="50" y1="10" x2="46" y2="16" stroke={fg} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>

      {/* ── Wordmark + optional sub-label ── */}
      {showWordmark && (
        <div className="flex flex-col leading-none" style={{ gap: showSubLabel ? 3 : 0 }}>
          <span
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: wordmarkFontSize,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              color: wordmarkColor,
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
