import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/catalog/ProductDetail";
import { Breadcrumbs, StoreLayout } from "@/components/layout/StoreShell";
import { createStorefrontCatalog } from "@/lib/catalog";

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
      title: `${product.title} — Demo Shop`,
      description: product.description ?? `Buy ${product.title} from the PIM catalog`,
      alternates: { canonical: `/product/${id}` },
    };
  } catch {
    return { title: "Product — Demo Shop" };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const catalog = createStorefrontCatalog();

  let product;
  try {
    product = await catalog.getProduct(id);
  } catch {
    notFound();
  }

  let variants: Awaited<ReturnType<typeof catalog.listVariants>>["items"] = [];
  if (product.productType === "PARENT") {
    const result = await catalog.listVariants(product.id);
    variants = result.items;
  } else if (product.productType === "VARIANT" && product.parentId) {
    const result = await catalog.listVariants(product.parentId);
    variants = result.items;
  }

  return (
    <StoreLayout>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: product.title },
        ]}
      />
      <ProductDetail product={product} variants={variants} />
    </StoreLayout>
  );
}
