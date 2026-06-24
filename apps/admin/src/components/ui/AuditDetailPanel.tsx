"use client";

import type { AuditLogEntity } from "@productinfoman/domain";
import { StatusChip } from "./StatusChip";

function JsonBlock({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700">{label}</h3>
      <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
        {value ? JSON.stringify(value, null, 2) : "—"}
      </pre>
    </div>
  );
}

export function AuditDetailPanel({
  log,
  onClose,
}: {
  log: AuditLogEntity;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Audit entry</h2>
            <p className="text-sm text-slate-500">{new Date(log.createdAt).toLocaleString()}</p>
          </div>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-5 p-5 text-sm">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-slate-500">Entity</dt>
              <dd className="font-medium">{log.entityType}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Entity ID</dt>
              <dd className="font-mono text-xs">{log.entityId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Action</dt>
              <dd>
                <StatusChip status={log.action} />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Source</dt>
              <dd className="font-medium">{log.source}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Actor</dt>
              <dd className="font-mono text-xs">{log.actorId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Correlation</dt>
              <dd className="font-mono text-xs">{log.correlationId ?? "—"}</dd>
            </div>
          </dl>

          <JsonBlock label="Before" value={log.before} />
          <JsonBlock label="After" value={log.after} />
          <JsonBlock label="Changed fields" value={log.changedFields} />
        </div>
      </div>
    </div>
  );
}
