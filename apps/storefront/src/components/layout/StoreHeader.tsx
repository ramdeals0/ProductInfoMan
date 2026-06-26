"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartIcon, CloseIcon, MenuIcon, SearchIcon } from "@/components/icons/Icons";
import { PromoBar } from "@/components/layout/PromoBar";
import { useCartStore } from "@/lib/cart";
import { createStorefrontCatalog } from "@/lib/catalog";

export function StoreHeader() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDepartment, setActiveDepartment] = useState<string | null>(null);
  const itemCount = useCartStore((state) => state.itemCount());
  const catalog = createStorefrontCatalog();

  const treeQuery = useQuery({
    queryKey: ["category-tree"],
    queryFn: () => catalog.getCategoryTree(),
  });

  const departments = treeQuery.data?.items ?? [];
  const activeDeptNode = departments.find((dept) => dept.id === activeDepartment) ?? null;

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setMobileOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="relative sticky top-0 z-40 border-b border-brand-200 bg-white shadow-sm">
      <PromoBar />

      <div className="container-store border-b border-brand-100">
        <div className="flex h-16 items-center gap-4 lg:h-[4.5rem]">
          <button
            type="button"
            className="btn-secondary -ml-2 border-transparent p-2.5 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <Link href="/" className="text-xl font-semibold tracking-tight text-brand-900 lg:text-2xl">
            Northline
          </Link>

          <form onSubmit={onSearch} className="relative ml-auto hidden max-w-xl flex-1 lg:block">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
            <input
              className="input border-brand-200 bg-surface-muted pl-10"
              placeholder="Search products, brands, and categories"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>

          <Link
            href="/cart"
            className="relative flex h-10 w-10 items-center justify-center text-brand-700 transition hover:text-brand-900"
            aria-label={`Cart with ${itemCount} items`}
          >
            <CartIcon />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-semibold text-white">
                {itemCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      <div className="container-store hidden lg:block">
        <nav
          className="flex items-center gap-1"
          onMouseLeave={() => setActiveDepartment(null)}
        >
          <Link
            href="/search"
            className="px-3 py-3 text-sm font-semibold text-brand-800 transition hover:bg-brand-50 hover:text-brand-900"
          >
            Shop All
          </Link>
          {departments.map((department) => (
            <div
              key={department.id}
              className="relative"
              onMouseEnter={() => setActiveDepartment(department.id)}
            >
              <Link
                href={`/category/${department.code}`}
                className={
                  activeDepartment === department.id
                    ? "block bg-brand-50 px-3 py-3 text-sm font-semibold text-brand-900"
                    : "block px-3 py-3 text-sm font-semibold text-brand-800 transition hover:bg-brand-50 hover:text-brand-900"
                }
              >
                {department.name}
              </Link>
            </div>
          ))}
        </nav>
      </div>

      {activeDeptNode && activeDeptNode.children.length > 0 ? (
        <div
          className="absolute left-0 right-0 hidden border-b border-brand-200 bg-white shadow-elevated lg:block"
          onMouseEnter={() => setActiveDepartment(activeDeptNode.id)}
          onMouseLeave={() => setActiveDepartment(null)}
        >
          <div className="container-store grid gap-6 py-6 md:grid-cols-2 lg:grid-cols-4">
            {activeDeptNode.children.map((child) => (
              <div key={child.id}>
                <Link
                  href={`/category/${child.code}`}
                  className="text-sm font-semibold text-brand-900 hover:text-accent-600"
                >
                  {child.name}
                </Link>
                {child.children.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {child.children.slice(0, 6).map((grandchild) => (
                      <li key={grandchild.id}>
                        <Link
                          href={`/category/${grandchild.code}`}
                          className="text-sm text-brand-600 hover:text-accent-600"
                        >
                          {grandchild.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {mobileOpen ? (
        <div className="border-t border-brand-100 bg-white py-5 lg:hidden">
          <form onSubmit={onSearch} className="relative mb-5 px-4">
            <SearchIcon className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
            <input
              className="input pl-10"
              placeholder="Search products"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
          <nav className="flex flex-col gap-1 border-b border-brand-100 px-2 pb-5">
            <Link
              href="/search"
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
              onClick={() => setMobileOpen(false)}
            >
              Shop All
            </Link>
            {departments.map((department) => (
              <Link
                key={department.id}
                href={`/category/${department.code}`}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                onClick={() => setMobileOpen(false)}
              >
                {department.name}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
