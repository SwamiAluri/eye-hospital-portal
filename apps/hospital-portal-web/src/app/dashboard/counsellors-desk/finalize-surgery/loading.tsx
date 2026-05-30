export default function FinalizeSurgeryLoading() {
  return (
    <div className="p-4 animate-pulse space-y-4">
      <div className="h-20 bg-gray-100 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="h-10 bg-gray-100 rounded-xl" />
      <div className="h-96 bg-gray-100 rounded-xl" />
    </div>
  );
}
