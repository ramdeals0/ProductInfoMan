"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { CheckIcon } from "@/components/icons/Icons";
import { Breadcrumbs, StoreLayout } from "@/components/layout/StoreShell";
import { useCartStore } from "@/lib/cart";

function SuccessContent() {
  const searchParams = useSearchParams();
  const clear = useCartStore((state) => state.clear);
  const mode = searchParams.get("mode") ?? "stripe";
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <StoreLayout>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Order confirmed" }]} />
      <div className="mx-auto max-w-lg rounded-3xl border border-brand-100 bg-surface-card px-8 py-12 text-center shadow-elevated">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 text-accent-600">
          <CheckIcon className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-display text-3xl text-brand-900">Thank you for your order!</h1>
        <p className="mt-3 text-brand-600">
          {mode === "mock"
            ? "Your order has been placed successfully. You'll receive a confirmation email shortly."
            : "Payment received. We'll send you a confirmation email with tracking details soon."}
        </p>
        {sessionId ? (
          <p className="mt-4 text-xs text-brand-400">Reference: {sessionId}</p>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/search" className="btn-primary">
            Continue shopping
          </Link>
          <Link href="/" className="btn-secondary">
            Back to home
          </Link>
        </div>
      </div>
    </StoreLayout>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
