"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  {
    href: "/admin/taxonomy",
    label: "Taxonomy",
    children: [
      { href: "/admin/taxonomy/categories", label: "Categories" },
      { href: "/admin/taxonomy/attributes", label: "Attributes" },
      { href: "/admin/taxonomy/facets", label: "Facets" },
    ],
  },
  { href: "/admin/imports", label: "Imports" },
  { href: "/admin/workflow", label: "Workflow" },
  { href: "/admin/publishing", label: "Publishing" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/reports", label: "Reports" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
      <div className="flex h-16 items-center border-b border-slate-200 px-6">
        <Link href="/admin/dashboard" className="text-lg font-semibold text-brand-700">
          ProductInfoMan
        </Link>
      </div>
      <nav className="space-y-1 p-4">
        {NAV.map((item) => (
          <div key={item.href}>
            <Link
              href={item.href}
              className={clsx(
                "block rounded-lg px-3 py-2 text-sm font-medium",
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-700 hover:bg-slate-100",
              )}
            >
              {item.label}
            </Link>
            {item.children ? (
              <div className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-3">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={clsx(
                      "block rounded-lg px-3 py-1.5 text-sm",
                      pathname === child.href
                        ? "font-medium text-brand-700"
                        : "text-slate-600 hover:text-brand-600",
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </nav>
    </aside>
  );
}
