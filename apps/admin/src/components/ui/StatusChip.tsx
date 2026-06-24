import clsx from "clsx";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  IN_REVIEW: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PUBLISH_READY: "bg-indigo-100 text-indigo-800",
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  ARCHIVED: "bg-slate-200 text-slate-600",
  DEPRECATED: "bg-slate-200 text-slate-500",
  QUEUED: "bg-slate-100 text-slate-700",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
  RETRYING: "bg-amber-100 text-amber-800",
  OPEN: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-slate-200 text-slate-600",
  VALIDATED: "bg-blue-100 text-blue-800",
  UPLOADED: "bg-slate-100 text-slate-700",
  SKIPPED: "bg-slate-100 text-slate-600",
  EXPORTED: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-slate-100 text-slate-700",
  PUBLISHED_OUTBOX: "bg-emerald-100 text-emerald-800",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700",
      )}
    >
      {status}
    </span>
  );
}
