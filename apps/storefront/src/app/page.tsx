import Link from "next/link";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/catalog/ProductCard";
import { StoreLayout, PageTitle } from "@/components/layout/StoreShell";
import { createStorefrontCatalog } from "@/lib/catalog";
import { flattenCategories } from "@/lib/search-params";
import type { CategoryTreeNode } from "@productinfoman/domain";

function sectionCategories(root: CategoryTreeNode): CategoryTreeNode[] {
  return [root, ...flattenCategories(root.children)];
}

export const metadata: Metadata = {
  title: "Demo Shop — Home",
  description: "Browse featured categories and products from the PIM catalog",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = createStorefrontCatalog();
  const [tree, featured] = await Promise.all([
    catalog.getCategoryTree(),
    catalog.searchProducts({ page: 1, pageSize: 8 }),
  ]);

  const categorySections = tree.items.map((root) => ({
    root,
    categories: sectionCategories(root),
  }));

  return (
    <StoreLayout>
      <section className="card mb-10 overflow-hidden bg-gradient-to-br from-brand-600 to-brand-900 p-8 text-white md:p-12">
        <h1 className="text-4xl font-bold tracking-tight">Quality products, PIM-powered</h1>
        <p className="mt-4 max-w-2xl text-lg text-brand-100">
          Browse approved and published catalog data from ProductInfoMan — faceted search, rich
          attributes, and variant support.
        </p>
        <Link href="/search" className="btn mt-6 bg-white text-brand-700 hover:bg-brand-50">
          Shop all products
        </Link>
      </section>

      <PageTitle title="Shop by category" description="Full category tree from your PIM taxonomy" />
      <div className="mb-12 space-y-10">
        {categorySections.map(({ root, categories }) => (
          <section key={root.id}>
            <h2 className="mb-4 text-xl font-semibold text-slate-900">{root.name}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.code}`}
                  className="card p-5 transition hover:border-brand-300 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold text-slate-900">{category.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{category.path}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <PageTitle title="Featured products" description="Recently indexed published products" />
      <ProductGrid items={featured.items} />
    </StoreLayout>
  );
}
