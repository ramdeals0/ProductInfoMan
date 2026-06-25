import Image from "next/image";
import Link from "next/link";
import type { SearchHitEntity } from "@productinfoman/domain";
import { StarIcon } from "@/components/icons/Icons";
import {
  formatPrice,
  formatRating,
  productImageUrl,
  resolveHitPrice,
  resolveProductRating,
} from "@/lib/catalog";

function StarRating({ sku }: { sku: string }) {
  const { score, count } = resolveProductRating(sku);
  const fullStars = Math.round(score);

  return (
    <div className="mt-2 flex items-center gap-1.5">
      <div className="flex text-accent-500">
        {Array.from({ length: 5 }).map((_, index) => (
          <StarIcon key={index} filled={index < fullStars} className="h-3.5 w-3.5" />
        ))}
      </div>
      <span className="text-xs text-brand-500">
        {formatRating(score)} ({count})
      </span>
    </div>
  );
}

export function ProductCard({ hit }: { hit: SearchHitEntity }) {
  const price = resolveHitPrice(hit.sku);
  const image = productImageUrl(hit.product_id, hit.title);

  return (
    <Link
      href={`/product/${hit.product_id}`}
      className="group overflow-hidden rounded-2xl border border-brand-100 bg-surface-card shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-elevated"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-muted">
        <Image
          src={image}
          alt={hit.title}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-950/50 to-transparent p-4 opacity-0 transition group-hover:opacity-100">
          <span className="text-xs font-semibold uppercase tracking-wider text-white">View product</span>
        </div>
      </div>
      <div className="p-4">
        {hit.brand ? (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-400">{hit.brand}</p>
        ) : null}
        <h3 className="mt-1 font-medium leading-snug text-brand-900 line-clamp-2">{hit.title}</h3>
        <StarRating sku={hit.sku} />
        <p className="mt-2 text-base font-semibold text-brand-900">{formatPrice(price)}</p>
      </div>
    </Link>
  );
}

export function ProductGrid({ items }: { items: SearchHitEntity[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-200 bg-surface-card px-8 py-16 text-center">
        <p className="font-display text-xl text-brand-800">No products found</p>
        <p className="mt-2 text-sm text-brand-500">Try adjusting your filters or search term.</p>
        <Link href="/search" className="btn-primary mt-6 inline-flex">
          Browse all products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
      {items.map((hit) => (
        <ProductCard key={hit.product_id} hit={hit} />
      ))}
    </div>
  );
}
