"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { docsNav } from "@/config/docs-nav";
import { apiRootUrl } from "@/config/docs-urls";
import { siteConfig } from "@/config/site";

function NavLink({ href, title }: { href: string; title: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={clsx(
        "block rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-brand-50 font-medium text-brand-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      {title}
    </Link>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function DocsSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="border-b border-slate-200 px-5 py-5">
          <Link href="/" className="text-lg font-bold text-slate-900">
            {siteConfig.name}
          </Link>
          <p className="mt-1 text-xs text-slate-500">API reference & guides</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {docsNav.map((section) => (
            <NavSection key={section.title} title={section.title}>
              {section.items.map((item) => (
                <NavLink key={item.href} href={item.href} title={item.title} />
              ))}
            </NavSection>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export function DocsTopbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <div className="lg:hidden">
          <Link href="/" className="font-semibold text-slate-900">
            Dev Portal
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <a
            href={siteConfig.adminUrl}
            className="text-slate-600 hover:text-brand-600"
            target="_blank"
            rel="noreferrer"
          >
            Admin UI
          </a>
          <a
            href={siteConfig.storefrontUrl}
            className="text-slate-600 hover:text-brand-600"
            target="_blank"
            rel="noreferrer"
          >
            Storefront
          </a>
          <a
            href={`${apiRootUrl()}/health`}
            className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
            target="_blank"
            rel="noreferrer"
          >
            API Health
          </a>
        </div>
      </div>
    </header>
  );
}

export function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <DocsTopbar />
      <div className="mx-auto flex max-w-7xl">
        <DocsSidebar />
        <main className="min-w-0 flex-1 px-4 py-8 lg:px-10">
          <article className="prose prose-slate max-w-none prose-headings:scroll-mt-20 prose-a:text-brand-600 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none">
            {children}
          </article>
        </main>
      </div>
    </div>
  );
}
