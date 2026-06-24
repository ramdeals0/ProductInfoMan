import Link from "next/link";
import { StoreLayout } from "@/components/layout/StoreShell";

export default function ProductNotFound() {
  return (
    <StoreLayout>
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Product not found</h1>
        <p className="mt-2 text-slate-600">
          This product may be unpublished or no longer available in the catalog.
        </p>
        <Link href="/search" className="btn-primary mt-6 inline-flex">
          Browse products
        </Link>
      </div>
    </StoreLayout>
  );
}
