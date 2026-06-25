"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createStorefrontCatalog } from "@/lib/catalog";
import { categorySelectOptions } from "@/lib/search-params";

function currentCategorySlug(pathname: string): string {
  const match = pathname.match(/^\/category\/([^/]+)/);
  return match?.[1] ?? "";
}

export function CategoryDropdown() {
  const pathname = usePathname();
  const router = useRouter();
  const catalog = createStorefrontCatalog();
  const selectedCode = currentCategorySlug(pathname);

  const treeQuery = useQuery({
    queryKey: ["category-tree"],
    queryFn: () => catalog.getCategoryTree(),
  });

  const options = treeQuery.data ? categorySelectOptions(treeQuery.data.items) : [];

  return (
    <select
      id="category-select"
      aria-label="Browse categories"
      className="input w-auto min-w-[10rem] max-w-[14rem] shrink-0"
      value={selectedCode}
      disabled={treeQuery.isLoading || options.length === 0}
      onChange={(event) => {
        const code = event.target.value;
        if (!code) {
          router.push("/");
          return;
        }
        router.push(`/category/${code}`);
      }}
    >
      <option value="">Categories</option>
      {options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
