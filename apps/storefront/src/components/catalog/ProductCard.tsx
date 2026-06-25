import Image from "next/image";
import Link from "next/link";
import type { SearchHitEntity } from "@productinfoman/domain";
import { formatPrice, productImageUrl, resolveHitPrice } from "@/lib/catalog";

export function ProductCard({ hit }: { hit: SearchHitEntity }) {
  const price = resolveHitPrice(hit.sku);
  const image = productImageUrl(hit.product_id, hit.title);

  return (
    <Link
      href={`/product/${hit.product_id}`}
      className="group block"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-muted">
        <Image
          src={image}
          alt={hit.title}
          fill
          className="object-cover transition duration-300 group-hover:opacity-95"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
      </div>
      <div className="mt-3">
        {hit.brand ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand-400">{hit.brand}</p>
        ) : null}
        <h3 className="mt-1 text-sm font-medium leading-snug text-brand-900 line-clamp-2">{hit.title}</h3>
        <p className="mt-1.5 text-sm text-brand-700">{formatPrice(price)}</p>
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
