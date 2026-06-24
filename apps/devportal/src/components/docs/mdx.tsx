"use client";

import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { adminUrl, resolveDocUrls, storefrontUrl } from "@/config/docs-urls";

type CodeBlockProps = {
  children: ReactNode;
  language?: string;
  title?: string;
};

function normalizeCodeChildren(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map((child) => normalizeCodeChildren(child)).join("");
  if (children == null) return "";
  return String(children);
}

export function CodeBlock({ children, language = "text", title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const content = resolveDocUrls(normalizeCodeChildren(children).trim());

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {title ?? language}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-slate-100">
        <code>{content}</code>
      </pre>
    </div>
  );
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const methodColors: Record<Method, string> = {
  GET: "bg-emerald-100 text-emerald-800",
  POST: "bg-blue-100 text-blue-800",
  PUT: "bg-amber-100 text-amber-800",
  PATCH: "bg-orange-100 text-orange-800",
  DELETE: "bg-red-100 text-red-800",
};

type EndpointProps = {
  method: Method;
  path: string;
  description?: string;
  adminLink?: string;
  storefrontLink?: string;
  adminPath?: string;
  storefrontPath?: string;
};

function resolveLink(explicit?: string, path?: string, resolver = adminUrl): string | undefined {
  if (path) return resolver(path);
  if (!explicit) return undefined;
  if (explicit.startsWith("/")) return resolver(explicit);
  return resolveDocUrls(explicit);
}

export function Endpoint({
  method,
  path,
  description,
  adminLink,
  storefrontLink,
  adminPath,
  storefrontPath,
}: EndpointProps) {
  const resolvedAdmin = resolveLink(adminLink, adminPath, adminUrl);
  const resolvedStore = resolveLink(storefrontLink, storefrontPath, storefrontUrl);
  return (
    <div className="not-prose my-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={clsx(
            "rounded-md px-2 py-1 text-xs font-bold tracking-wide",
            methodColors[method],
          )}
        >
          {method}
        </span>
        <code className="text-sm font-semibold text-slate-900">{path}</code>
      </div>
      {description ? <p className="mt-3 text-sm text-slate-600">{description}</p> : null}
      {(resolvedAdmin || resolvedStore) && (
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {resolvedAdmin ? (
            <a href={resolvedAdmin} className="font-medium text-brand-600 hover:text-brand-700">
              Admin UI →
            </a>
          ) : null}
          {resolvedStore ? (
            <a href={resolvedStore} className="font-medium text-brand-600 hover:text-brand-700">
              Storefront →
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}

type CalloutProps = {
  children: React.ReactNode;
  variant?: "info" | "warning" | "tip";
};

const calloutStyles = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  tip: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export function Callout({ children, variant = "info" }: CalloutProps) {
  return (
    <div className={clsx("not-prose my-6 rounded-xl border px-4 py-3 text-sm", calloutStyles[variant])}>
      {children}
    </div>
  );
}

type ParamRow = { name: string; in: string; type: string; required?: boolean; description: string };

export function ParamsTable({ rows }: { rows: ParamRow[] }) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Name</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">In</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Type</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => (
            <tr key={`${row.in}-${row.name}`}>
              <td className="px-4 py-2 font-mono text-slate-900">
                {row.name}
                {row.required ? <span className="ml-1 text-red-500">*</span> : null}
              </td>
              <td className="px-4 py-2 text-slate-600">{row.in}</td>
              <td className="px-4 py-2 font-mono text-slate-700">{row.type}</td>
              <td className="px-4 py-2 text-slate-600">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
