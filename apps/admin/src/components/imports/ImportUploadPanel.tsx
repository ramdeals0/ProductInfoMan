"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ImportFileType } from "@productinfoman/domain";
import { downloadImportExample, IMPORT_EXAMPLE_TYPES } from "@/lib/import-examples";
import { useSession } from "@/lib/session";

const FILE_TYPE_OPTIONS: Array<{ value: ImportFileType; label: string }> = [
  { value: "CSV", label: "CSV" },
  { value: "JSON", label: "JSON" },
  { value: "XML", label: "XML" },
];

function inferFileType(fileName: string): ImportFileType {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "json") return "JSON";
  if (extension === "xml") return "XML";
  return "CSV";
}

export function ImportUploadPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { api } = useSession();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<ImportFileType>("CSV");
  const [importType, setImportType] = useState<"CREATE" | "UPDATE" | "UPSERT">("CREATE");
  const [error, setError] = useState<string | null>(null);

  const helpText = useMemo(() => {
    if (fileType === "JSON") {
      return "Upload a JSON array of product objects. Nested fields are flattened with dot notation (e.g. attributes.color).";
    }
    if (fileType === "XML") {
      return "Upload XML with a root element containing repeated <product> nodes. Nested elements map to dotted field paths.";
    }
    return "Upload a comma-separated file with a header row. Column names are mapped through your import template.";
  }, [fileType]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file to upload");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", fileType);
      formData.append("importType", importType);
      return api.uploadImport(formData);
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["imports"] });
      setOpen(false);
      setFile(null);
      setError(null);
      router.push(`/admin/imports/${job.id}`);
    },
    onError: (mutationError) => {
      setError((mutationError as Error).message);
    },
  });

  if (!open) {
    return (
      <div className="mb-6">
        <button className="btn-primary" type="button" onClick={() => setOpen(true)}>
          Upload import
        </button>
      </div>
    );
  }

  return (
    <div className="card mb-6 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Upload import file</h2>
          <p className="mt-1 text-sm text-slate-600">{helpText}</p>
        </div>
        <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">File</span>
          <input
            type="file"
            accept=".csv,.json,.xml,text/csv,application/json,application/xml,text/xml"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setFile(nextFile);
              if (nextFile) setFileType(inferFileType(nextFile.name));
            }}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">File type</span>
          <select
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={fileType}
            onChange={(event) => setFileType(event.target.value as ImportFileType)}
          >
            {FILE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Import mode</span>
          <select
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={importType}
            onChange={(event) => setImportType(event.target.value as "CREATE" | "UPDATE" | "UPSERT")}
          >
            <option value="CREATE">Add only</option>
            <option value="UPDATE">Update only</option>
            <option value="UPSERT">Add or update</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Download example:</span>
        {IMPORT_EXAMPLE_TYPES.map((type) => (
          <button
            key={type}
            className="btn-secondary text-xs"
            type="button"
            onClick={() => downloadImportExample(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-slate-500">
        JSON expects a root array of product objects. XML expects repeated &lt;product&gt; elements under a root
        node. Nested fields flatten to dotted paths for template mapping.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex gap-2">
        <button
          className="btn-primary"
          type="button"
          disabled={!file || uploadMutation.isPending}
          onClick={() => uploadMutation.mutate()}
        >
          {uploadMutation.isPending ? "Uploading..." : "Upload"}
        </button>
      </div>
    </div>
  );
}
