import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/catalog/ProductDetail";
import { Breadcrumbs, StoreLayout } from "@/components/layout/StoreShell";
import { createStorefrontCatalog } from "@/lib/catalog";
import { buildCategoryBreadcrumbs } from "@/lib/search-params";
import type { ProductEntity } from "@productinfoman/domain";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const catalog = createStorefrontCatalog();

  try {
    const product = await catalog.getProduct(id);
    return {
      title: product.title,
      description: product.summary ?? product.description ?? `Shop ${product.title} at Northline`,
      alternates: { canonical: `/product/${id}` },
    };
  } catch {
    return { title: "Product" };
  }
}

async function resolveProductContext(
  catalog: ReturnType<typeof createStorefrontCatalog>,
  id: string,
): Promise<{ product: ProductEntity; variants: ProductEntity[]; selectedId: string }> {
  const fetched = await catalog.getProduct(id);

  if (fetched.productType === "PARENT") {
    const variants = (await catalog.listVariants(fetched.id)).items;
    return {
      product: fetched,
      variants,
      selectedId: variants[0]?.id ?? fetched.id,
    };
  }

  if (fetched.productType === "VARIANT" && fetched.parentId) {
    const variants = (await catalog.listVariants(fetched.parentId)).items;
    try {
      const parent = await catalog.getProduct(fetched.parentId);
      return { product: parent, variants, selectedId: fetched.id };
    } catch {
      return { product: fetched, variants, selectedId: fetched.id };
    }
  }

  return { product: fetched, variants: [], selectedId: fetched.id };
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const catalog = createStorefrontCatalog();

  let context;
  try {
    context = await resolveProductContext(catalog, id);
  } catch {
    notFound();
  }

  const { product, variants, selectedId } = context;

  const breadcrumbItems: Array<{ label: string; href?: string }> = [{ label: "Home", href: "/" }];

  if (product.primaryCategoryId) {
    const { items: categories } = await catalog.listCategories();
    const category = categories.find((entry) => entry.id === product.primaryCategoryId);
    if (category) {
      breadcrumbItems.push(...buildCategoryBreadcrumbs(categories, category).slice(1));
    }
  }

  breadcrumbItems.push({ label: product.title });

  return (
    <StoreLayout variant="product">
      <Breadcrumbs items={breadcrumbItems} />
      <ProductDetail product={product} variants={variants} initialSelectedId={selectedId} />
    </StoreLayout>
  );
}
