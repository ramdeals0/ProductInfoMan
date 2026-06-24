"use client";

import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs, PageTitle, StoreLayout } from "@/components/layout/StoreShell";
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
      <PageTitle title="Your cart" description={`${items.length} line item(s)`} />

      {items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-slate-600">Your cart is empty.</p>
          <Link href="/search" className="btn-primary mt-4 inline-flex">
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.productId} className="card flex gap-4 p-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link
                      href={`/product/${item.productId}`}
                      className="font-medium text-slate-900 hover:text-brand-600"
                    >
                      {item.name}
                    </Link>
                    <p className="text-sm text-slate-500">{item.sku}</p>
                    <p className="mt-1 font-medium">{formatPrice(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-3">
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
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="card h-fit p-6">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-medium">{formatPrice(subtotal)}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Shipping and tax calculated at checkout.</p>
            <Link href="/checkout" className="btn-primary mt-6 w-full">
              Checkout
            </Link>
          </aside>
        </div>
      )}
    </StoreLayout>
  );
}
