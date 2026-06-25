import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/catalog/ProductCard";
import { TrustBadges } from "@/components/catalog/TrustBadges";
import { StoreLayout } from "@/components/layout/StoreShell";
import { categoryImageUrl, createStorefrontCatalog } from "@/lib/catalog";
import type { CategoryTreeNode } from "@productinfoman/domain";

export const metadata: Metadata = {
  title: "Home",
  description: "Shop curated apparel, home goods, and everyday essentials at Northline.",
};

export const dynamic = "force-dynamic";

function topLevelCategories(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes.slice(0, 6);
}

export default async function HomePage() {
  const catalog = createStorefrontCatalog();
  const [tree, featured] = await Promise.all([
    catalog.getCategoryTree(),
    catalog.searchProducts({ page: 1, pageSize: 8 }),
  ]);

  const categories = topLevelCategories(tree.items);

  return (
    <StoreLayout>
      <section className="relative overflow-hidden rounded-3xl bg-brand-900 text-white">
        <div className="absolute inset-0 bg-hero-pattern" />
        <div className="relative grid gap-8 px-6 py-14 md:grid-cols-2 md:items-center md:px-12 md:py-20 lg:px-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-300">
              Spring collection
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight md:text-5xl lg:text-6xl">
              Quality goods for everyday life
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-brand-200 md:text-lg">
              Discover apparel, home essentials, and tools chosen for lasting quality — shipped fast,
              backed by easy returns.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/search" className="btn-accent px-7">
                Shop now
              </Link>
              <Link href="/search?q=new" className="btn border border-white/30 bg-white/10 text-white hover:bg-white/20">
                New arrivals
              </Link>
            </div>
          </div>
          <div className="relative hidden aspect-[4/3] overflow-hidden rounded-2xl md:block">
            <Image
              src={categoryImageUrl("hero")}
              alt="Featured collection"
              fill
              className="object-cover"
              sizes="50vw"
              priority
            />
          </div>
        </div>
      </section>

      <section className="mt-10">
        <TrustBadges />
      </section>

      {categories.length > 0 ? (
        <section className="mt-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="section-heading">Shop by category</h2>
              <p className="section-subheading">Browse our most popular departments</p>
            </div>
            <Link href="/search" className="link-underline hidden text-sm font-medium sm:inline">
              View all
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.code}`}
                className="group relative overflow-hidden rounded-2xl"
              >
                <div className="relative aspect-[16/10]">
                  <Image
                    src={categoryImageUrl(category.code)}
                    alt={category.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-950/80 via-brand-950/20 to-transparent" />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-display text-2xl text-white">{category.name}</h3>
                  <p className="mt-1 text-sm text-brand-200 opacity-0 transition group-hover:opacity-100">
                    Shop {category.name.toLowerCase()} →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-16 overflow-hidden rounded-3xl bg-accent-50 px-6 py-10 md:flex md:items-center md:justify-between md:px-12">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-700">Limited time</p>
          <h2 className="mt-2 font-display text-3xl text-brand-900">Up to 25% off select styles</h2>
          <p className="mt-2 text-brand-600">Refresh your wardrobe and home with seasonal favorites.</p>
        </div>
        <Link href="/search?q=sale" className="btn-primary mt-6 shrink-0 md:mt-0">
          Shop the sale
        </Link>
      </section>

      <section className="mt-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="section-heading">Trending now</h2>
            <p className="section-subheading">Customer favorites from our latest catalog</p>
          </div>
          <Link href="/search" className="link-underline hidden text-sm font-medium sm:inline">
            See all products
          </Link>
        </div>
        <div className="mt-8">
          <ProductGrid items={featured.items} />
        </div>
      </section>
    </StoreLayout>
  );
}
