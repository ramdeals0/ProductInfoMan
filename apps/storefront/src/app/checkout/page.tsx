"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckIcon } from "@/components/icons/Icons";
import { TrustBadges } from "@/components/catalog/TrustBadges";
import { Breadcrumbs, PageTitle, StoreLayout } from "@/components/layout/StoreShell";
import { ErrorMessage } from "@/components/ui/States";
import { formatPrice } from "@/lib/catalog";
import { useCartStore } from "@/lib/cart";

type CheckoutResponse =
  | { mode: "stripe"; url: string }
  | { mode: "mock"; success: true };

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal());
  const clear = useCartStore((state) => state.clear);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      router.replace("/cart");
    }
  }, [items.length, router]);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Checkout failed");
      }

      const data = (await response.json()) as CheckoutResponse;

      if (data.mode === "stripe" && data.url) {
        window.location.href = data.url;
        return;
      }

      clear();
      router.push("/checkout/success?mode=mock");
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return null;
  }

  const shipping = subtotal >= 75 ? 0 : 6.95;
  const total = subtotal + shipping;

  return (
    <StoreLayout>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Cart", href: "/cart" },
          { label: "Checkout" },
        ]}
      />
      <PageTitle title="Checkout" description="Review your order and complete your purchase" />

      {error ? <ErrorMessage message={error} /> : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card p-6">
          <h2 className="font-display text-xl text-brand-900">Your items</h2>
          <ul className="mt-5 divide-y divide-brand-100">
            {items.map((item) => (
              <li key={item.productId} className="flex justify-between gap-4 py-4 text-sm">
                <div>
                  <p className="font-medium text-brand-900">{item.name}</p>
                  <p className="mt-1 text-brand-500">Qty {item.quantity}</p>
                </div>
                <span className="font-medium text-brand-900">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="card h-fit p-6 md:sticky md:top-28">
          <h2 className="font-display text-xl text-brand-900">Payment summary</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-brand-500">Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-500">Shipping</span>
              <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
            </div>
          </div>
          <div className="mt-4 flex justify-between border-t border-brand-100 pt-4 text-lg font-semibold">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>

          <button
            type="button"
            onClick={startCheckout}
            disabled={loading}
            className="btn-primary mt-6 w-full"
          >
            {loading ? "Processing…" : "Place order"}
          </button>

          <p className="mt-3 text-center text-xs text-brand-500">
            Secure checkout via Stripe when configured, or demo mode otherwise.
          </p>

          <div className="mt-6">
            <TrustBadges compact />
          </div>
        </aside>
      </div>
    </StoreLayout>
  );
}
