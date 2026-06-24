import Image from "next/image";
import Link from "next/link";
import type { SearchHitEntity } from "@productinfoman/domain";
import { formatPrice, productImageUrl, resolveHitPrice } from "@/lib/catalog";

export function ProductCard({ hit }: { hit: SearchHitEntity }) {
  const price = resolveHitPrice(hit.sku);
  const image = productImageUrl(hit.product_id, hit.title);

  return (
    <Link href={`/product/${hit.product_id}`} className="card group overflow-hidden transition hover:shadow-md">
      <div className="relative aspect-square bg-slate-100">
        <Image
          src={image}
          alt={hit.title}
          fill
          className="object-cover transition group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
      </div>
      <div className="p-4">
        {hit.brand ? <p className="text-xs uppercase tracking-wide text-slate-500">{hit.brand}</p> : null}
        <h3 className="mt-1 font-medium text-slate-900 line-clamp-2">{hit.title}</h3>
        <p className="mt-2 text-sm font-semibold text-brand-700">{formatPrice(price)}</p>
      </div>
    </Link>
  );
}

export function ProductGrid({ items }: { items: SearchHitEntity[] }) {
  if (items.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-500">
        No products found. Try adjusting your filters or search term.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {items.map((hit) => (
        <ProductCard key={hit.product_id} hit={hit} />
      ))}
    </div>
  );
}
