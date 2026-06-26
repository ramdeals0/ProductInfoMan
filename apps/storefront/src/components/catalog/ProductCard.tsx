import Image from "next/image";
import Link from "next/link";
import type { SearchHitEntity } from "@productinfoman/domain";
import {
  formatPrice,
  formatRating,
  productImageUrl,
  resolveHitPrice,
  resolveProductRating,
} from "@/lib/catalog";

function StarRating({ score }: { score: number }) {
  const fullStars = Math.floor(score);
  const hasHalf = score - fullStars >= 0.5;

  return (
    <div className="flex items-center gap-0.5 text-accent-500" aria-label={`${score} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={
            index < fullStars
              ? "text-accent-500"
              : index === fullStars && hasHalf
                ? "text-accent-300"
                : "text-brand-200"
          }
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function ProductCard({ hit }: { hit: SearchHitEntity }) {
  const price = resolveHitPrice(hit.sku);
  const image = productImageUrl(hit.product_id, hit.title);
  const rating = resolveProductRating(hit.sku);

  return (
    <Link href={`/product/${hit.product_id}`} className="group product-tile h-full">
      <div className="product-tile-image">
        <Image
          src={image}
          alt={hit.title}
          fill
          className="object-cover transition duration-300 group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 50vw, 20vw"
        />
      </div>
      <div className="space-y-1.5 p-3">
        {hit.brand ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">{hit.brand}</p>
        ) : null}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-brand-900">
          {hit.title}
        </h3>
        <div className="flex items-center gap-2">
          <StarRating score={rating.score} />
          <span className="text-xs text-brand-500">({rating.count})</span>
        </div>
        <p className="text-base font-semibold text-brand-900">{formatPrice(price)}</p>
        <p className="text-xs text-brand-400">Item #{hit.sku}</p>
      </div>
    </Link>
  );
}

export function ProductCardListRow({ hit }: { hit: SearchHitEntity }) {
  const price = resolveHitPrice(hit.sku);
  const image = productImageUrl(hit.product_id, hit.title);
  const rating = resolveProductRating(hit.sku);

  return (
    <Link
      href={`/product/${hit.product_id}`}
      className="product-tile flex gap-4 p-3 sm:items-center"
    >
      <div className="product-tile-image h-28 w-28 shrink-0 sm:h-32 sm:w-32">
        <Image
          src={image}
          alt={hit.title}
          fill
          className="object-cover"
          sizes="128px"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {hit.brand ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">{hit.brand}</p>
          ) : null}
          <h3 className="text-base font-medium text-brand-900">{hit.title}</h3>
          <div className="mt-1 flex items-center gap-2">
            <StarRating score={rating.score} />
            <span className="text-xs text-brand-500">
              {formatRating(rating.score)} ({rating.count})
            </span>
          </div>
          <p className="mt-1 text-xs text-brand-400">Item #{hit.sku}</p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-lg font-semibold text-brand-900">{formatPrice(price)}</p>
          <span className="mt-2 inline-flex text-sm font-semibold text-accent-600">View details →</span>
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ items }: { items: SearchHitEntity[] }) {
  if (items.length === 0) return <EmptyResults />;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {items.map((hit) => (
        <ProductCard key={hit.product_id} hit={hit} />
      ))}
    </div>
  );
}

export function ProductList({ items }: { items: SearchHitEntity[] }) {
  if (items.length === 0) return <EmptyResults />;

  return (
    <div className="space-y-3">
      {items.map((hit) => (
        <ProductCardListRow key={hit.product_id} hit={hit} />
      ))}
    </div>
  );
}

function EmptyResults() {
  return (
    <div className="rounded-lg border border-dashed border-brand-200 bg-surface-muted px-8 py-16 text-center">
      <p className="text-lg font-semibold text-brand-800">No products found</p>
      <p className="mt-2 text-sm text-brand-500">Try adjusting your filters or search term.</p>
      <Link href="/search" className="btn-primary mt-6 inline-flex">
        Browse all products
      </Link>
    </div>
  );
}
