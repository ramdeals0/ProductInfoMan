"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { ProductEntity } from "@productinfoman/domain";
import { useCartStore } from "@/lib/cart";
import {
  formatPrice,
  productImageUrl,
  resolveProductPrice,
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
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="card relative aspect-square overflow-hidden bg-slate-100">
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
          <p className="text-sm uppercase tracking-wide text-slate-500">{selected.brand}</p>
        ) : null}
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{product.title}</h1>
        {product.summary ? (
          <p className="mt-4 text-lg text-slate-700">{product.summary}</p>
        ) : product.description ? (
          <p className="mt-4 text-slate-600">{product.description}</p>
        ) : null}

        {product.sellingPoints.length > 0 ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Why you&apos;ll love it
            </h2>
            <ul className="mt-3 space-y-2">
              {product.sellingPoints.map((point) => (
                <li key={point} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-1 text-brand-600">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-6 text-2xl font-semibold text-brand-700">{formatPrice(price)}</p>
        <p className="mt-1 text-sm text-slate-500">SKU: {selected.sku}</p>

        {selectableVariants.length > 1 ? (
          <div className="mt-6">
            <p className="text-sm font-medium text-slate-700">Options</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectableVariants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedId(variant.id)}
                  className={
                    variant.id === selectedId
                      ? "rounded-lg border-2 border-brand-600 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700"
                      : "rounded-lg border border-slate-300 px-3 py-2 text-sm hover:border-brand-400"
                  }
                >
                  {variantLabel(variant)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex items-center gap-4">
          <label className="text-sm font-medium text-slate-700">
            Qty
            <input
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={(event) =>
                setQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))
              }
              className="input ml-2 w-20"
            />
          </label>
          <button type="button" onClick={onAddToCart} className="btn-primary">
            {added ? "Added!" : "Add to cart"}
          </button>
        </div>

        {selected.attributes.length > 0 ? (
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-slate-900">Specifications</h2>
            <dl className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
              {selected.attributes.map((attr) => (
                <div key={attr.key} className="grid grid-cols-2 gap-4 px-4 py-3 text-sm">
                  <dt className="font-medium capitalize text-slate-600">{attr.key}</dt>
                  <dd className="text-slate-900">{String(attr.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}
