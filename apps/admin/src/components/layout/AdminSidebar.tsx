"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useSession } from "@/lib/session";
import {
  canManageMdm,
  canManageTaxonomy,
  canManageUsers,
  canReadCatalog,
  canViewSecuritySettings,
} from "@/lib/permissions";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", visible: () => true },
  { href: "/admin/products", label: "Products", visible: canReadCatalog },
  {
    href: "/admin/taxonomy",
    label: "Taxonomy",
    visible: canManageTaxonomy,
    children: [
      { href: "/admin/taxonomy/categories", label: "Categories" },
      { href: "/admin/taxonomy/attributes", label: "Attributes" },
      { href: "/admin/taxonomy/facets", label: "Facets" },
    ],
  },
  { href: "/admin/imports", label: "Imports", visible: canReadCatalog },
  { href: "/admin/workflow", label: "Workflow", visible: canReadCatalog },
  { href: "/admin/publishing", label: "Publishing", visible: canReadCatalog },
  {
    href: "/admin/mdm",
    label: "MDM",
    visible: (roles: string[]) => canManageMdm(roles) || canReadCatalog(roles),
    children: [
      { href: "/admin/mdm/source-records", label: "Source records" },
      { href: "/admin/mdm/survivorship-rules", label: "Survivorship rules" },
    ],
  },
  { href: "/admin/audit", label: "Audit", visible: canReadCatalog },
  { href: "/admin/reports", label: "Reports", visible: canReadCatalog },
  { href: "/admin/users", label: "Users", visible: canManageUsers },
  { href: "/admin/security", label: "Security", visible: canViewSecuritySettings },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useSession();

  if (!user) {
    return (
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          <span className="text-lg font-semibold text-brand-700">ProductInfoMan</span>
        </div>
        <nav className="space-y-1 p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-9 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </nav>
      </aside>
    );
  }

  const roles = user.roles;
  const items = NAV.filter((item) => item.visible(roles));

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
      <div className="flex h-16 items-center border-b border-slate-200 px-6">
        <Link href="/admin/dashboard" className="text-lg font-semibold text-brand-700">
          ProductInfoMan
        </Link>
      </div>
      <nav className="space-y-1 p-4">
        {items.map((item) => (
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
            {"children" in item && item.children ? (
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
