"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartIcon, CloseIcon, MenuIcon, SearchIcon } from "@/components/icons/Icons";
import { useCartStore } from "@/lib/cart";
import { createStorefrontCatalog } from "@/lib/catalog";

const NAV_LINKS = [
  { href: "/search", label: "Shop" },
  { href: "/#collections", label: "Collections" },
];

export function StoreHeader() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const itemCount = useCartStore((state) => state.itemCount());
  const catalog = createStorefrontCatalog();

  const treeQuery = useQuery({
    queryKey: ["category-tree"],
    queryFn: () => catalog.getCategoryTree(),
  });

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setMobileOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100/80 bg-surface/90 backdrop-blur-md">
      <div className="container-store">
        <div className="flex h-[4.25rem] items-center gap-5 lg:h-20">
          <button
            type="button"
            className="btn-secondary -ml-2 border-transparent p-2.5 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <Link
            href="/"
            className="font-display text-[1.65rem] tracking-tight text-brand-900 lg:text-[1.85rem]"
          >
            Northline
          </Link>

          <nav className="ml-2 hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-brand-600 transition hover:text-brand-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <form onSubmit={onSearch} className="relative ml-auto hidden max-w-sm flex-1 lg:block">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
            <input
              className="input border-brand-100 bg-white/80 pl-10"
              placeholder="Search"
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
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-900 px-1 text-[10px] font-semibold text-white">
                {itemCount}
              </span>
            ) : null}
          </Link>
        </div>

        {mobileOpen ? (
          <div className="border-t border-brand-100 py-5 lg:hidden">
            <form onSubmit={onSearch} className="relative mb-5">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
              <input
                className="input pl-10"
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
            <nav className="flex flex-col gap-1 border-b border-brand-100 pb-5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-800 hover:bg-brand-50"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {treeQuery.data?.items.length ? (
              <div className="pt-5">
                <p className="px-3 text-[11px] font-medium uppercase tracking-[0.2em] text-brand-400">
                  Collections
                </p>
                <ul className="mt-3 space-y-1">
                  {treeQuery.data.items.map((category) => (
                    <li key={category.id}>
                      <Link
                        href={`/category/${category.code}`}
                        className="block rounded-lg px-3 py-2 text-sm text-brand-700 hover:bg-brand-50"
                        onClick={() => setMobileOpen(false)}
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
