"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`?${params.toString()}`);
  };

  if (totalPages <= 1) return null;

  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, page + 2);
  const pages: number[] = [];
  for (let current = windowStart; current <= windowEnd; current += 1) {
    pages.push(current);
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-4 border-t border-brand-100 pt-6">
      <p className="text-sm text-brand-600">
        Showing page {page} of {totalPages} ({total.toLocaleString()} items)
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="btn-secondary px-4"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
        >
          Previous
        </button>
        {windowStart > 1 ? (
          <>
            <button type="button" className="btn-secondary min-w-10 px-3" onClick={() => goToPage(1)}>
              1
            </button>
            {windowStart > 2 ? <span className="px-1 text-brand-400">…</span> : null}
          </>
        ) : null}
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={
              pageNumber === page
                ? "min-w-10 rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white"
                : "btn-secondary min-w-10 px-3"
            }
            onClick={() => goToPage(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        {windowEnd < totalPages ? (
          <>
            {windowEnd < totalPages - 1 ? <span className="px-1 text-brand-400">…</span> : null}
            <button
              type="button"
              className="btn-secondary min-w-10 px-3"
              onClick={() => goToPage(totalPages)}
            >
              {totalPages}
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="btn-secondary px-4"
          disabled={page >= totalPages}
          onClick={() => goToPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
