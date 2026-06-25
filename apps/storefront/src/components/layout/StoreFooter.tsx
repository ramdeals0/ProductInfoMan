"use client";

import Link from "next/link";

const SHOP_LINKS = [
  { label: "All products", href: "/search" },
  { label: "New arrivals", href: "/search?q=new" },
  { label: "Best sellers", href: "/search?q=best" },
];

const HELP_LINKS = [
  { label: "Shipping & delivery", href: "/search" },
  { label: "Returns & exchanges", href: "/search" },
  { label: "Contact us", href: "/search" },
];

export function StoreFooter() {
  return (
    <footer className="mt-16 border-t border-brand-100 bg-brand-950 text-brand-200">
      <div className="container-store grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Link href="/" className="font-display text-2xl text-white">
            Northline
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-brand-300">
            Thoughtfully sourced goods for your home and wardrobe. Quality you can feel, prices you
            can trust.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Shop</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {SHOP_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Customer care</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {HELP_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="transition hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Stay in touch</h3>
          <p className="mt-4 text-sm text-brand-300">
            Get early access to new collections and exclusive offers.
          </p>
          <form className="mt-4 flex gap-2" onSubmit={(event) => event.preventDefault()}>
            <input
              type="email"
              placeholder="Your email"
              className="input flex-1 border-brand-700 bg-brand-900 text-white placeholder:text-brand-400"
              aria-label="Email address"
            />
            <button type="submit" className="btn-accent shrink-0 px-4">
              Join
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-brand-800">
        <div className="container-store flex flex-col items-center justify-between gap-3 py-6 text-xs text-brand-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Northline. All rights reserved.</p>
          <div className="flex gap-4">
            <span>Visa</span>
            <span>Mastercard</span>
            <span>Amex</span>
            <span>PayPal</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
