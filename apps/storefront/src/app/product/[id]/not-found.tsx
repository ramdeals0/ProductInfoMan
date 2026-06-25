import Link from "next/link";
import { StoreLayout } from "@/components/layout/StoreShell";

export default function ProductNotFound() {
  return (
    <StoreLayout>
      <div className="mx-auto max-w-lg rounded-2xl border border-brand-100 bg-surface-card px-8 py-12 text-center">
        <h1 className="font-display text-2xl text-brand-900">Product not found</h1>
        <p className="mt-3 text-brand-600">
          This item may be unavailable or no longer in our catalog.
        </p>
        <Link href="/search" className="btn-primary mt-8 inline-flex">
          Browse products
        </Link>
      </div>
    </StoreLayout>
  );
}
