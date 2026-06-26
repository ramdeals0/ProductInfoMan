"use client";

import Image from "next/image";
import { useState } from "react";
import { productImageUrl } from "@/lib/catalog";

export function ProductImageGallery({
  productId,
  title,
  imageCount = 4,
}: {
  productId: string;
  title: string;
  imageCount?: number;
}) {
  const images = Array.from({ length: imageCount }, (_, index) =>
    productImageUrl(`${productId}-${index}`, title),
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-brand-200 bg-surface-muted">
        <Image
          src={images[selectedIndex]!}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 45vw"
          priority
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {images.map((image, index) => (
          <button
            key={image}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className={
              index === selectedIndex
                ? "relative aspect-square overflow-hidden rounded-md border-2 border-brand-800"
                : "relative aspect-square overflow-hidden rounded-md border border-brand-200 hover:border-brand-400"
            }
          >
            <Image src={image} alt="" fill className="object-cover" sizes="96px" />
          </button>
        ))}
      </div>
    </div>
  );
}
