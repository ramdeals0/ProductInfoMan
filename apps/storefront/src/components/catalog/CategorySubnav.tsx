"use client";

import Link from "next/link";
import type { CategoryTreeNode } from "@productinfoman/domain";

export function CategorySubnav({ subcategories }: { subcategories: CategoryTreeNode[] }) {
  if (subcategories.length === 0) return null;

  return (
    <section className="catalog-panel mb-6 overflow-hidden">
      <div className="border-b border-brand-200 bg-surface-muted px-4 py-2.5">
        <h2 className="text-sm font-semibold text-brand-900">Shop by Category</h2>
      </div>
      <div className="grid gap-px bg-brand-100 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {subcategories.map((subcategory) => (
          <Link
            key={subcategory.id}
            href={`/category/${subcategory.code}`}
            className="bg-white px-4 py-3 text-sm font-medium text-brand-800 transition hover:bg-brand-50 hover:text-brand-900"
          >
            {subcategory.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
