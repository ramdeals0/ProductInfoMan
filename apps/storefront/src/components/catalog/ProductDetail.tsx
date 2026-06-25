"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { ProductEntity } from "@productinfoman/domain";
import { CheckIcon, StarIcon } from "@/components/icons/Icons";
import { TrustBadges } from "@/components/catalog/TrustBadges";
import { useCartStore } from "@/lib/cart";
import {
  formatPrice,
  formatRating,
  productImageUrl,
  resolveProductPrice,
  resolveProductRating,
} from "@/lib/catalog";

type ProductDetailProps = {
  product: ProductEntity;
  variants: ProductEntity[];
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

export function ProductDetail({ product, variants }: ProductDetailProps) {
  const addItem = useCartStore((state) => state.addItem);
  const selectableVariants = variants.length > 0 ? variants : [product];
  const [selectedId, setSelectedId] = useState(selectableVariants[0]!.id);
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
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-surface-muted">
        <Image
          src={image}
          alt={selected.title}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>

      <div>
        {selected.brand ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">{selected.brand}</p>
        ) : null}
        <h1 className="mt-2 font-display text-3xl text-brand-900 md:text-4xl">{product.title}</h1>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex text-accent-500">
            {Array.from({ length: 5 }).map((_, index) => (
              <StarIcon
                key={index}
                filled={index < Math.round(rating.score)}
                className="h-4 w-4"
              />
            ))}
          </div>
          <span className="text-sm text-brand-600">
            {formatRating(rating.score)} · {rating.count} reviews
          </span>
        </div>

        <p className="mt-6 text-3xl font-semibold text-brand-900">{formatPrice(price)}</p>
        <p className="mt-1 text-sm text-brand-500">SKU: {selected.sku}</p>

        {product.summary ? (
          <p className="mt-6 text-lg leading-relaxed text-brand-700">{product.summary}</p>
        ) : product.description ? (
          <p className="mt-6 leading-relaxed text-brand-600">{product.description}</p>
        ) : null}

        {product.sellingPoints.length > 0 ? (
          <ul className="mt-6 space-y-2.5">
            {product.sellingPoints.slice(0, 5).map((point) => (
              <li key={point} className="flex gap-2.5 text-sm text-brand-700">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {selectableVariants.length > 1 ? (
          <div className="mt-8">
            <p className="text-sm font-semibold text-brand-800">Select option</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectableVariants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedId(variant.id)}
                  className={
                    variant.id === selectedId
                      ? "rounded-lg border-2 border-brand-800 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-900"
                      : "rounded-lg border border-brand-200 px-4 py-2.5 text-sm text-brand-700 transition hover:border-brand-400"
                  }
                >
                  {variantLabel(variant)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-brand-800">
            Quantity
            <input
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={(event) =>
                setQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))
              }
              className="input w-20"
            />
          </label>
          <button
            type="button"
            onClick={onAddToCart}
            className={added ? "btn-accent px-8" : "btn-primary px-8"}
          >
            {added ? "Added to cart" : "Add to cart"}
          </button>
        </div>

        <div className="mt-8">
          <TrustBadges compact />
        </div>

        {selected.attributes.length > 0 ? (
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-brand-900">Product details</h2>
            <dl className="mt-4 divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-100">
              {selected.attributes.map((attr) => (
                <div key={attr.key} className="grid grid-cols-2 gap-4 bg-surface-card px-5 py-3.5 text-sm">
                  <dt className="font-medium capitalize text-brand-500">{attr.key.replace(/_/g, " ")}</dt>
                  <dd className="text-brand-900">{String(attr.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}
