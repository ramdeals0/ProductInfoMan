import Link from "next/link";
import { PageHeader } from "@/components/layout/AdminShell";

const sections = [
  {
    href: "/admin/taxonomy/categories",
    title: "Categories",
    description: "Manage the category hierarchy and category-scoped attribute sets.",
  },
  {
    href: "/admin/taxonomy/attributes",
    title: "Attributes",
    description: "View attribute groups and definitions used across the catalog.",
  },
  {
    href: "/admin/taxonomy/facets",
    title: "Facets",
    description: "Review facet definitions and rules for browse and search.",
  },
];

export default function TaxonomyPage() {
  return (
    <div>
      <PageHeader
        title="Taxonomy"
        description="Organize categories, attributes, and facet configuration."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="card p-5 hover:border-brand-200">
            <h2 className="font-medium text-slate-900">{section.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
