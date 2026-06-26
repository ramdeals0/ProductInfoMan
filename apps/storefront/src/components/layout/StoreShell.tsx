import Link from "next/link";
import { StoreFooter } from "@/components/layout/StoreFooter";
import { StoreHeader } from "@/components/layout/StoreHeader";

export function StoreLayout({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "catalog" | "product";
}) {
  const mainClass =
    variant === "catalog"
      ? "container-store flex-1 py-6 md:py-8"
      : variant === "product"
        ? "container-store flex-1 py-6 md:py-8"
        : "container-store flex-1 py-10 md:py-14";

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <StoreHeader />
      <main className={mainClass}>{children}</main>
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
    <div className="mb-5 border-b border-brand-200 pb-4">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-900 md:text-3xl">{title}</h1>
      {description ? <p className="mt-1 text-sm text-brand-600">{description}</p> : null}
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-xs text-brand-500 sm:text-sm">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <span className="text-brand-300">›</span> : null}
            {item.href ? (
              <Link href={item.href} className="transition hover:text-accent-600 hover:underline">
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
