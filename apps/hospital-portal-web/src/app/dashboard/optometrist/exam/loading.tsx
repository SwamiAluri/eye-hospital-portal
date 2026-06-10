export default function OptometristExamLoading() {
  return (
    <div className="h-full flex flex-col bg-gray-50 animate-pulse">
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-200" />
            <div>
              <div className="h-4 bg-gray-200 rounded w-40 mb-1.5" />
              <div className="h-3 bg-gray-200 rounded w-56" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-8 bg-gray-200 rounded w-20" />
            <div className="h-8 bg-gray-200 rounded w-24" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        </div>
        <div className="h-10 bg-gray-100 mt-3 rounded" />
        <div className="flex gap-2 mt-3 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 bg-gray-200 rounded w-28 shrink-0" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6 space-y-4">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
