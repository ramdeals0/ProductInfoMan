"use client";

import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs, PageTitle, StoreLayout } from "@/components/layout/StoreShell";
import { TrustBadges } from "@/components/catalog/TrustBadges";
import { formatPrice } from "@/lib/catalog";
import { useCartStore } from "@/lib/cart";

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const subtotal = useCartStore((state) => state.subtotal());

  return (
    <StoreLayout>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
      <PageTitle title="Shopping bag" description={`${items.length} item${items.length === 1 ? "" : "s"}`} />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-surface-card px-8 py-16 text-center">
          <p className="font-display text-2xl text-brand-900">Your bag is empty</p>
          <p className="mt-2 text-brand-500">Looks like you haven&apos;t added anything yet.</p>
          <Link href="/search" className="btn-primary mt-8 inline-flex">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.productId} className="card flex gap-4 p-4 md:p-5">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="112px"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link
                      href={`/product/${item.productId}`}
                      className="font-medium text-brand-900 transition hover:text-accent-600"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-sm text-brand-500">{item.sku}</p>
                    <p className="mt-2 font-semibold text-brand-900">{formatPrice(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={item.quantity}
                      onChange={(event) =>
                        updateQuantity(
                          item.productId,
                          Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                        )
                      }
                      className="input w-20"
                      aria-label={`Quantity for ${item.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="text-sm font-medium text-brand-500 transition hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="card h-fit p-6 md:sticky md:top-28">
            <h2 className="font-display text-xl text-brand-900">Order summary</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-500">Subtotal</span>
                <span className="font-medium text-brand-900">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-500">Shipping</span>
                <span className="font-medium text-brand-900">
                  {subtotal >= 75 ? "Free" : "Calculated at checkout"}
                </span>
              </div>
            </div>
            <div className="mt-4 flex justify-between border-t border-brand-100 pt-4 text-base font-semibold">
              <span>Estimated total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <Link href="/checkout" className="btn-primary mt-6 w-full">
              Proceed to checkout
            </Link>
            <Link href="/search" className="mt-3 block text-center text-sm font-medium text-brand-600 hover:text-accent-600">
              Continue shopping
            </Link>
            <div className="mt-6">
              <TrustBadges compact />
            </div>
          </aside>
        </div>
      )}
    </StoreLayout>
  );
}
