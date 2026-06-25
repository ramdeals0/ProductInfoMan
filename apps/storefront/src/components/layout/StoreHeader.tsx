"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { CategoryDropdown } from "@/components/layout/CategoryDropdown";
import { useCartStore } from "@/lib/cart";

export function StoreHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const itemCount = useCartStore((state) => state.itemCount());

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold text-brand-700">
          Demo Shop
        </Link>
        <CategoryDropdown />
        <nav className="hidden items-center gap-4 text-sm font-medium text-slate-600 md:flex">
          <Link href="/search" className={pathname === "/search" ? "text-brand-600" : "hover:text-brand-600"}>
            Search
          </Link>
        </nav>
        <form onSubmit={onSearch} className="flex flex-1 items-center gap-2 md:ml-auto md:max-w-md">
          <input
            className="input"
            placeholder="Search products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn-secondary shrink-0">
            Search
          </button>
        </form>
        <Link href="/cart" className="btn-secondary relative">
          Cart
          {itemCount > 0 ? (
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs text-white">
              {itemCount}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
