export default function CounsellingSessionLoading() {
  return (
    <div className="flex flex-col animate-pulse" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="h-24 bg-gradient-to-r from-blue-200 to-indigo-200 rounded-xl mb-4" />
      <div className="bg-white rounded-xl border border-gray-100 flex-1 p-5 space-y-4">
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-gray-100 rounded-lg" />
          <div className="h-9 w-36 bg-gray-100 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
          <div className="lg:col-span-2 h-64 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
        <div className="h-32 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}
