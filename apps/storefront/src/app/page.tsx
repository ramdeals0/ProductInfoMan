import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/catalog/ProductCard";
import { CategoryShowcase } from "@/components/layout/CategoryShowcase";
import { StoreLayout } from "@/components/layout/StoreShell";
import { categoryImageUrl, createStorefrontCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Home",
  description: "Thoughtfully curated apparel, home goods, and essentials from Northline.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = createStorefrontCatalog();
  const [tree, featured] = await Promise.all([
    catalog.getCategoryTree(),
    catalog.searchProducts({ page: 1, pageSize: 8 }),
  ]);

  return (
    <StoreLayout>
      <section className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-center md:gap-14">
        <div className="max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-brand-400">
            Northline
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.1] text-brand-900 md:text-5xl lg:text-[3.25rem]">
            Essentials chosen with care
          </h1>
          <p className="mt-5 text-base leading-relaxed text-brand-600 md:text-lg">
            A considered edit of apparel, home, and everyday goods — organized from your live product
            catalog and ready to explore.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/search" className="btn-primary px-7">
              Browse the shop
            </Link>
            <Link href="/#collections" className="btn-secondary px-7">
              View collections
            </Link>
          </div>
        </div>
        <div className="relative aspect-[5/4] overflow-hidden rounded-2xl bg-surface-muted">
          <Image
            src={categoryImageUrl("hero")}
            alt="Curated collection"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 45vw"
            priority
          />
        </div>
      </section>

      <CategoryShowcase categories={tree.items} />

      <section className="mt-16 border-t border-brand-200/80 pt-14 md:pt-16">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-brand-400">Shop</p>
            <h2 className="mt-3 font-display text-3xl text-brand-900 md:text-[2.35rem]">
              Featured products
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-500 md:text-base">
              A selection from the current catalog — refreshed as your PIM data updates.
            </p>
          </div>
          <Link
            href="/search"
            className="text-sm font-medium text-brand-700 underline-offset-4 transition hover:text-brand-900 hover:underline"
          >
            View all products
          </Link>
        </div>
        <div className="mt-10">
          <ProductGrid items={featured.items} />
        </div>
      </section>
    </StoreLayout>
  );
}
