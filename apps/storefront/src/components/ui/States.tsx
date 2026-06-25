export function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-brand-100 bg-surface-card">
          <div className="aspect-[4/5] animate-pulse bg-brand-100" />
          <div className="space-y-2.5 p-4">
            <div className="h-2.5 w-1/3 rounded bg-brand-100" />
            <div className="h-4 w-full rounded bg-brand-100" />
            <div className="h-4 w-2/3 rounded bg-brand-100" />
            <div className="h-5 w-1/4 rounded bg-brand-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}
