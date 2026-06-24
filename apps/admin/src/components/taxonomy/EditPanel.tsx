"use client";

import type { ReactNode } from "react";

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
