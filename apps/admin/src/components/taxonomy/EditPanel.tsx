"use client";

import type { ReactNode } from "react";

export function InlineEditForm({
  onClose,
  onSave,
  saving,
  children,
}: {
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/40 p-4">
      {children}
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={saving} onClick={onSave}>
          Save changes
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** @deprecated Use InlineEditForm embedded in the row being edited */
export function EditPanel({
  title,
  onClose,
  onSave,
  saving,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="card mb-4 space-y-3 border-brand-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-slate-900">{title}</h3>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
      {children}
      <button type="button" className="btn-primary" disabled={saving} onClick={onSave}>
        Save changes
      </button>
    </div>
  );
}
