"use client";

import Link from "next/link";
import { FooterCategoryLinks } from "@/components/layout/FooterCategoryLinks";

const HELP_LINKS = [
  { label: "Shipping & delivery", href: "/search" },
  { label: "Returns & exchanges", href: "/search" },
  { label: "Contact us", href: "/search" },
];

export function StoreFooter() {
  return (
    <footer className="mt-16 border-t border-brand-200 bg-white text-brand-600">
      <div className="container-store grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Link href="/" className="font-display text-2xl text-brand-900">
            Northline
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-brand-500">
            A refined storefront for curated goods — built on your product information, presented with
            clarity.
          </p>
        </div>

        <FooterCategoryLinks />

        <div>
          <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Customer care</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {HELP_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="transition hover:text-brand-900">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Newsletter</h3>
          <p className="mt-4 text-sm text-brand-500">
            Occasional notes on new arrivals and collections.
          </p>
          <form className="mt-4 flex gap-2" onSubmit={(event) => event.preventDefault()}>
            <input
              type="email"
              placeholder="Email address"
              className="input flex-1"
              aria-label="Email address"
            />
            <button type="submit" className="btn-primary shrink-0 px-4">
              Join
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-brand-100">
        <div className="container-store flex flex-col items-center justify-between gap-3 py-6 text-xs text-brand-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Northline. All rights reserved.</p>
          <p className="text-brand-300">Powered by ProductInfoMan</p>
        </div>
      </div>
    </footer>
  );
}
