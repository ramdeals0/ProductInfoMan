"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProductEntity } from "@productinfoman/domain";
import { useCartStore } from "@/lib/cart";
import { formatPrice, productImageUrl, resolveProductPrice } from "@/lib/catalog";

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
    <article className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-muted">
        <Image
          src={image}
          alt={selected.title}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>

      <div className="flex flex-col">
        {selected.brand ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-brand-400">
            {selected.brand}
          </p>
        ) : null}

        <h1 className="mt-3 font-display text-3xl leading-tight text-brand-900 md:text-4xl">
          {product.title}
        </h1>

        <p className="mt-5 text-2xl text-brand-900">{formatPrice(price)}</p>
        <p className="mt-2 text-sm text-brand-400">SKU {selected.sku}</p>

        {product.summary ? (
          <p className="mt-8 text-base leading-relaxed text-brand-700">{product.summary}</p>
        ) : product.description ? (
          <p className="mt-8 leading-relaxed text-brand-600">{product.description}</p>
        ) : null}

        {product.sellingPoints.length > 0 ? (
          <ul className="mt-6 space-y-2 border-t border-brand-100 pt-6">
            {product.sellingPoints.slice(0, 5).map((point) => (
              <li key={point} className="text-sm leading-relaxed text-brand-600">
                {point}
              </li>
            ))}
          </ul>
        ) : null}

        {selectableVariants.length > 1 ? (
          <div className="mt-8 border-t border-brand-100 pt-8">
            <p className="text-sm font-medium text-brand-800">Options</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectableVariants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedId(variant.id)}
                  className={
                    variant.id === selectedId
                      ? "rounded-full border border-brand-900 bg-brand-900 px-4 py-2 text-sm font-medium text-white"
                      : "rounded-full border border-brand-200 px-4 py-2 text-sm text-brand-700 transition hover:border-brand-400"
                  }
                >
                  {variantLabel(variant)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-end gap-4 border-t border-brand-100 pt-8">
          <label className="block text-sm font-medium text-brand-800">
            Quantity
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
            className={added ? "btn-accent px-8" : "btn-primary px-8"}
          >
            {added ? "Added to cart" : "Add to cart"}
          </button>
        </div>

        <p className="mt-6 text-sm text-brand-500">
          <Link href="/cart" className="underline-offset-4 hover:underline">
            View cart
          </Link>
          {" · "}
          <Link href="/search" className="underline-offset-4 hover:underline">
            Continue shopping
          </Link>
        </p>

        {selected.attributes.length > 0 ? (
          <div className="mt-10 border-t border-brand-100 pt-10">
            <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-brand-400">
              Details
            </h2>
            <dl className="mt-5 divide-y divide-brand-100">
              {selected.attributes.map((attr) => (
                <div
                  key={attr.key}
                  className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] gap-4 py-3 text-sm"
                >
                  <dt className="capitalize text-brand-500">{attr.key.replace(/_/g, " ")}</dt>
                  <dd className="text-brand-900">{String(attr.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </article>
  );
}
