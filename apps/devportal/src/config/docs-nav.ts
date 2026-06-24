export type NavItem = {
  title: string;
  href: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const docsNav: NavSection[] = [
  {
    title: "Getting started",
    items: [
      { title: "Overview", href: "/docs/overview" },
      { title: "Authentication", href: "/docs/authentication" },
      { title: "Conventions", href: "/docs/conventions" },
    ],
  },
  {
    title: "Admin APIs",
    items: [
      { title: "Products & Variants", href: "/docs/admin-products" },
      { title: "Taxonomy & Facets", href: "/docs/admin-taxonomy" },
      { title: "Imports", href: "/docs/admin-imports" },
      { title: "Workflow", href: "/docs/admin-workflow" },
      { title: "Search Projection", href: "/docs/admin-search" },
      { title: "Publishing & Channels", href: "/docs/admin-publishing" },
      { title: "Audit & Reporting", href: "/docs/admin-audit" },
      { title: "Events & Eventing", href: "/docs/admin-events" },
    ],
  },
  {
    title: "Storefront",
    items: [{ title: "Catalog & Search", href: "/docs/storefront-catalog" }],
  },
];

export function flattenNavItems(): NavItem[] {
  return docsNav.flatMap((section) => section.items);
}
