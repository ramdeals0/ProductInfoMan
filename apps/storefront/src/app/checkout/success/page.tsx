"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Breadcrumbs, PageTitle, StoreLayout } from "@/components/layout/StoreShell";
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
      <div className="card mx-auto max-w-lg p-8 text-center">
        <PageTitle
          title="Thank you for your order!"
          description={
            mode === "mock"
              ? "Your mock checkout completed successfully."
              : "Payment received via Stripe Checkout."
          }
        />
        {sessionId ? (
          <p className="text-sm text-slate-500">Session: {sessionId}</p>
        ) : null}
        <Link href="/" className="btn-primary mt-6 inline-flex">
          Continue shopping
        </Link>
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
