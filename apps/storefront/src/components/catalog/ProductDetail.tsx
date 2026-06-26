"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProductEntity } from "@productinfoman/domain";
import { ProductImageGallery } from "@/components/catalog/ProductImageGallery";
import { TrustBadges } from "@/components/catalog/TrustBadges";
import { useCartStore } from "@/lib/cart";
import { formatPrice, productImageUrl, resolveProductPrice, resolveProductRating, formatRating } from "@/lib/catalog";

type ProductDetailProps = {
  product: ProductEntity;
  variants: ProductEntity[];
  initialSelectedId?: string;
};

function variantLabel(variant: ProductEntity): string {
  const axisAttrs = variant.attributes.filter((attr) =>
    ["color", "size", "style"].includes(attr.key.toLowerCase()),
  );
  if (axisAttrs.length > 0) {
    return axisAttrs.map((attr) => String(attr.value)).join(" / ");
  }
  return variant.sku;
}

export function ProductDetail({ product, variants, initialSelectedId }: ProductDetailProps) {
  const addItem = useCartStore((state) => state.addItem);
  const selectableVariants = variants.length > 0 ? variants : [product];
  const defaultSelectedId =
    initialSelectedId && selectableVariants.some((variant) => variant.id === initialSelectedId)
      ? initialSelectedId
      : selectableVariants[0]!.id;
  const [selectedId, setSelectedId] = useState(defaultSelectedId);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const selected = useMemo(
    () => selectableVariants.find((variant) => variant.id === selectedId) ?? product,
    [selectableVariants, selectedId, product],
  );

  const price = resolveProductPrice(selected);
  const image = productImageUrl(selected.id, selected.title);
  const rating = resolveProductRating(selected.sku);

  const onAddToCart = () => {
    addItem(
      {
        productId: selected.id,
        sku: selected.sku,
        name: selected.title,
        price,
        imageUrl: image,
      },
      quantity,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <article>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <ProductImageGallery productId={selected.id} title={selected.title} />

        <div className="catalog-panel p-5 lg:p-6">
          {selected.brand ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">{selected.brand}</p>
          ) : null}

          <h1 className="mt-2 text-2xl font-semibold leading-tight text-brand-900 md:text-3xl">
            {product.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-brand-600">
            <div className="flex items-center gap-1 text-accent-500">
              <span className="font-semibold text-brand-900">{formatRating(rating.score)}</span>
              <span>★</span>
              <span className="text-brand-500">({rating.count} reviews)</span>
            </div>
            <span className="text-brand-300">|</span>
            <span>
              Item # <span className="font-medium text-brand-800">{selected.sku}</span>
            </span>
          </div>

          <p className="mt-5 text-3xl font-semibold text-brand-900">{formatPrice(price)}</p>

          {product.summary ? (
            <p className="mt-4 text-sm leading-relaxed text-brand-700">{product.summary}</p>
          ) : null}

          {selectableVariants.length > 1 ? (
            <div className="mt-6 border-t border-brand-100 pt-6">
              <p className="text-sm font-semibold text-brand-900">Select option</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectableVariants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedId(variant.id)}
                    className={
                      variant.id === selectedId
                        ? "rounded-md border-2 border-brand-800 bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
                        : "rounded-md border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:border-brand-500"
                    }
                  >
                    {variantLabel(variant)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-end gap-4 border-t border-brand-100 pt-6">
            <label className="block text-sm font-semibold text-brand-900">
              Qty
              <input
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(event) =>
                  setQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))
                }
                className="input mt-2 w-24"
              />
            </label>
            <button
              type="button"
              onClick={onAddToCart}
              className={added ? "btn-accent min-w-[12rem] flex-1 px-8" : "btn-primary min-w-[12rem] flex-1 px-8"}
            >
              {added ? "Added to cart" : "Add to cart"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-surface-muted px-4 py-3 text-sm">
              <p className="font-semibold text-brand-900">Store pickup</p>
              <p className="mt-1 text-brand-600">Available at select locations</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-surface-muted px-4 py-3 text-sm">
              <p className="font-semibold text-brand-900">Ship to home</p>
              <p className="mt-1 text-brand-600">Free shipping on orders over $75</p>
            </div>
          </div>

          <p className="mt-4 text-sm text-brand-500">
            <Link href="/cart" className="font-medium text-accent-600 hover:underline">
              View cart
            </Link>
            {" · "}
            <Link href="/search" className="font-medium text-accent-600 hover:underline">
              Continue shopping
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-8">
        <TrustBadges compact />
      </div>

      <div className="catalog-panel mt-8 overflow-hidden">
        <div className="divide-y divide-brand-200">
          <section className="p-5 md:p-6">
            <h2 className="text-lg font-semibold text-brand-900">Product Details</h2>
            <div className="prose-sm mt-4 max-w-3xl text-brand-700">
              {product.description ? (
                <p className="leading-relaxed">{product.description}</p>
              ) : (
                <p className="text-brand-500">No additional product details available.</p>
              )}
            </div>
          </section>

          <section className="p-5 md:p-6">
            <h2 className="text-lg font-semibold text-brand-900">Specifications</h2>
            <div className="mt-4">
              {selected.attributes.length > 0 ? (
                <dl className="spec-table grid overflow-hidden rounded-lg border border-brand-200 md:grid-cols-2">
                  {selected.attributes.map((attr) => (
                    <div key={attr.key} className="contents">
                      <dt className="capitalize">{attr.key.replace(/_/g, " ")}</dt>
                      <dd>{String(attr.value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-brand-500">No specifications listed for this product.</p>
              )}
            </div>
          </section>

          <section className="p-5 md:p-6">
            <h2 className="text-lg font-semibold text-brand-900">Features</h2>
            <div className="mt-4">
              {product.sellingPoints.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {product.sellingPoints.map((point) => (
                    <li
                      key={point}
                      className="flex gap-2 rounded-lg border border-brand-100 bg-surface-muted px-4 py-3 text-sm text-brand-700"
                    >
                      <span className="text-accent-500">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-brand-500">No feature highlights listed for this product.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
