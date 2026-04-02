export default function MatchupLoading() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navbar skeleton */}
      <div className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/90 h-16"/>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 animate-pulse">
        {/* Segmented control skeleton */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-gray-900 border border-gray-800 w-fit">
          <div className="h-8 w-24 bg-gray-800 rounded-lg"/>
          <div className="h-8 w-32 bg-gray-700 rounded-lg"/>
          <div className="h-8 w-20 bg-gray-800 rounded-lg"/>
        </div>

        {/* Header skeleton */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="h-7 w-48 bg-gray-800 rounded mb-2"/>
            <div className="h-4 w-64 bg-gray-800 rounded"/>
          </div>
          <div className="h-9 w-28 bg-gray-800 rounded-lg"/>
        </div>

        {/* Table skeleton */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="h-10 bg-gray-950/50 border-b border-gray-800"/>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60">
              <div className="w-6 h-4 bg-gray-800 rounded"/>
              <div className="w-8 h-8 rounded-full bg-gray-800"/>
              <div className="flex-1">
                <div className="h-3.5 w-28 bg-gray-800 rounded mb-1"/>
                <div className="h-2.5 w-16 bg-gray-800 rounded"/>
              </div>
              <div className="w-20 h-6 bg-gray-800 rounded-full"/>
              <div className="hidden sm:block w-24 h-4 bg-gray-800 rounded"/>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
