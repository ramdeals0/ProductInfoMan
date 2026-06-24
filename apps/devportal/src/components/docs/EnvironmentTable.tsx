"use client";

import { siteConfig } from "@/config/site";
import { apiRootUrl, adminUrl, storefrontUrl } from "@/config/docs-urls";

export function EnvironmentTable() {
  const rows = [
    {
      label: "This deployment",
      api: siteConfig.apiBaseUrl,
      admin: adminUrl(),
      storefront: storefrontUrl(),
    },
    {
      label: "Local development",
      api: "http://localhost:3001/api/v1",
      admin: "http://localhost:3000",
      storefront: "http://localhost:3002",
    },
  ];

  return (
    <div className="not-prose my-6 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Environment</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">API base</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Admin UI</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Storefront</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="px-4 py-2 font-medium text-slate-900">{row.label}</td>
              <td className="px-4 py-2 font-mono text-xs text-slate-700">{row.api}</td>
              <td className="px-4 py-2 font-mono text-xs text-slate-700">{row.admin}</td>
              <td className="px-4 py-2 font-mono text-xs text-slate-700">{row.storefront}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
        API health:{" "}
        <a
          href={`${apiRootUrl()}/health`}
          className="font-mono text-brand-600 hover:text-brand-700"
          target="_blank"
          rel="noreferrer"
        >
          {apiRootUrl()}/health
        </a>
      </p>
    </div>
  );
}
