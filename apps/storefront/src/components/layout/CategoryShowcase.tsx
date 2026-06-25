import Link from "next/link";
import type { CategoryTreeNode } from "@productinfoman/domain";

type CategoryShowcaseProps = {
  categories: CategoryTreeNode[];
};

function childLinks(nodes: CategoryTreeNode[], limit = 5): CategoryTreeNode[] {
  return nodes.slice(0, limit);
}

export function CategoryShowcase({ categories }: CategoryShowcaseProps) {
  if (categories.length === 0) return null;

  return (
    <section id="collections" className="scroll-mt-28 border-t border-brand-200/80 pt-14 md:pt-16">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-brand-400">Collections</p>
          <h2 className="mt-3 font-display text-3xl text-brand-900 md:text-[2.35rem]">
            Curated departments
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-500 md:text-base">
            Explore the catalog by department and specialty — each collection is organized from your
            live PIM taxonomy.
          </p>
        </div>
        <Link
          href="/search"
          className="text-sm font-medium text-brand-700 underline-offset-4 transition hover:text-brand-900 hover:underline"
        >
          View all products
        </Link>
      </div>

      <div className="mt-10 grid gap-12 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((root) => (
          <div key={root.id} className="min-w-0">
            <Link
              href={`/category/${root.code}`}
              className="group inline-flex items-center gap-2 font-display text-2xl text-brand-900 transition hover:text-brand-600"
            >
              {root.name}
              <span className="text-sm font-sans text-brand-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600">
                →
              </span>
            </Link>

            {root.children.length > 0 ? (
              <ul className="mt-5 space-y-4 border-l border-brand-200 pl-5">
                {childLinks(root.children).map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/category/${child.code}`}
                      className="text-sm font-medium text-brand-800 transition hover:text-brand-600"
                    >
                      {child.name}
                    </Link>
                    {child.children.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {childLinks(child.children, 4).map((leaf) => (
                          <li key={leaf.id}>
                            <Link
                              href={`/category/${leaf.code}`}
                              className="text-sm text-brand-500 transition hover:text-brand-800"
                            >
                              {leaf.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-brand-500">{root.path}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
