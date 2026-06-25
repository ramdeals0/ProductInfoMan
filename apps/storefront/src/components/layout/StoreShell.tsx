import Link from "next/link";
import { StoreFooter } from "@/components/layout/StoreFooter";
import { StoreHeader } from "@/components/layout/StoreHeader";

export function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <StoreHeader />
      <main className="container-store flex-1 py-10 md:py-14">{children}</main>
      <StoreFooter />
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
      <h1 className="section-heading">{title}</h1>
      {description ? <p className="section-subheading">{description}</p> : null}
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 text-sm text-brand-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-brand-300">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="transition hover:text-accent-600">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-brand-800">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
