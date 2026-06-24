"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

  return (
    <StoreLayout>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Cart", href: "/cart" },
          { label: "Checkout" },
        ]}
      />
      <PageTitle title="Checkout" description="Review your order before payment" />

      {error ? <ErrorMessage message={error} /> : null}

      <div className="card mt-6 max-w-lg p-6">
        <ul className="divide-y divide-slate-200">
          {items.map((item) => (
            <li key={item.productId} className="flex justify-between py-3 text-sm">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-semibold">
          <span>Total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>

        <button
          type="button"
          onClick={startCheckout}
          disabled={loading}
          className="btn-primary mt-6 w-full"
        >
          {loading ? "Processing…" : "Place order"}
        </button>

        <p className="mt-3 text-center text-xs text-slate-500">
          Uses Stripe Checkout when configured; otherwise completes a mock order.
        </p>
      </div>
    </StoreLayout>
  );
}
