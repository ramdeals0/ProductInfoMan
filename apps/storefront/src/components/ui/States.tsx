export function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="card animate-pulse overflow-hidden">
          <div className="aspect-square bg-slate-200" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-1/3 rounded bg-slate-200" />
            <div className="h-4 w-full rounded bg-slate-200" />
            <div className="h-4 w-1/4 rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}
