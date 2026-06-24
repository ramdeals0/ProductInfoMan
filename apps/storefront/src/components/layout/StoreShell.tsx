import Link from "next/link";
import { StoreHeader } from "@/components/layout/StoreHeader";

export function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <StoreHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        Powered by ProductInfoMan PIM · Catalog data from search projection
      </footer>
    </div>
  );
}

export function PageTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
      {description ? <p className="mt-2 text-slate-600">{description}</p> : null}
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav className="mb-4 text-sm text-slate-500">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 ? <span className="mx-2">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-brand-600">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-800">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
