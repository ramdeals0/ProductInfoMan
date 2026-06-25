"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { CategoryTreeNode } from "@productinfoman/domain";
import { createStorefrontCatalog } from "@/lib/catalog";

function CategoryColumn({ category }: { category: CategoryTreeNode }) {
  return (
    <div>
      <Link
        href={`/category/${category.code}`}
        className="text-sm font-medium text-brand-800 transition hover:text-brand-600"
      >
        {category.name}
      </Link>
      {category.children.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {category.children.slice(0, 4).map((child) => (
            <li key={child.id}>
              <Link
                href={`/category/${child.code}`}
                className="text-sm text-brand-500 transition hover:text-brand-800"
              >
                {child.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function FooterCategoryLinks() {
  const catalog = createStorefrontCatalog();
  const treeQuery = useQuery({
    queryKey: ["category-tree"],
    queryFn: () => catalog.getCategoryTree(),
  });

  const categories = treeQuery.data?.items ?? [];
  if (categories.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Collections</h3>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {categories.slice(0, 4).map((category) => (
          <CategoryColumn key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}
