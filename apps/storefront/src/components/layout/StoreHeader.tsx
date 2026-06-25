"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { CartIcon, CloseIcon, MenuIcon, SearchIcon } from "@/components/icons/Icons";
import { CategoryDropdown } from "@/components/layout/CategoryDropdown";
import { useCartStore } from "@/lib/cart";

const NAV_LINKS = [
  { href: "/search", label: "Shop all" },
  { href: "/search?q=sale", label: "Sale" },
];

export function StoreHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const itemCount = useCartStore((state) => state.itemCount());

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setMobileOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-surface-card/95 backdrop-blur-md">
      <div className="container-store">
        <div className="flex h-16 items-center gap-4 lg:h-[4.5rem]">
          <button
            type="button"
            className="btn-secondary -ml-2 border-transparent p-2.5 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <Link href="/" className="font-display text-2xl tracking-tight text-brand-900 lg:text-[1.75rem]">
            Northline
          </Link>

          <nav className="ml-4 hidden items-center gap-6 lg:flex">
            <CategoryDropdown />
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  pathname === link.href
                    ? "text-sm font-semibold text-accent-600"
                    : "text-sm font-medium text-brand-600 transition hover:text-brand-900"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <form onSubmit={onSearch} className="relative ml-auto hidden max-w-md flex-1 md:block">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
            <input
              className="input pl-10"
              placeholder="Search products, brands..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>

          <Link
            href="/cart"
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-brand-200 text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
            aria-label={`Cart with ${itemCount} items`}
          >
            <CartIcon />
            {itemCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white">
                {itemCount}
              </span>
            ) : null}
          </Link>
        </div>

        {mobileOpen ? (
          <div className="border-t border-brand-100 py-4 lg:hidden">
            <form onSubmit={onSearch} className="relative mb-4">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
              <input
                className="input pl-10"
                placeholder="Search products..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
            <div className="mb-4">
              <CategoryDropdown />
            </div>
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
}
