'use client';

export default function SeasonToggle({ season, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-gray-900 border border-gray-800 p-0.5">
      {['2025', '2026'].map(yr => (
        <button
          key={yr}
          onClick={() => onChange(yr)}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 ${
            season === yr
              ? 'bg-violet-600 text-white shadow shadow-violet-500/30'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {yr}
        </button>
      ))}
    </div>
  );
}
