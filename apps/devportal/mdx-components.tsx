import type { MDXComponents } from "mdx/types";
import { Callout, CodeBlock, Endpoint, ParamsTable } from "@/components/docs/mdx";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => <h1 className="text-3xl font-bold tracking-tight text-slate-900" {...props} />,
    h2: (props) => (
      <h2 className="mt-10 border-b border-slate-200 pb-2 text-2xl font-semibold" {...props} />
    ),
    h3: (props) => <h3 className="mt-8 text-xl font-semibold" {...props} />,
    p: (props) => <p className="leading-7 text-slate-700" {...props} />,
    ul: (props) => <ul className="my-4 list-disc space-y-2 pl-6 text-slate-700" {...props} />,
    ol: (props) => <ol className="my-4 list-decimal space-y-2 pl-6 text-slate-700" {...props} />,
    li: (props) => <li className="leading-7" {...props} />,
    a: (props) => <a className="font-medium text-brand-600 hover:text-brand-700" {...props} />,
    table: (props) => (
      <div className="not-prose my-6 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm" {...props} />
      </div>
    ),
    th: (props) => (
      <th className="bg-slate-50 px-4 py-2 text-left font-semibold text-slate-700" {...props} />
    ),
    td: (props) => <td className="px-4 py-2 text-slate-600" {...props} />,
    CodeBlock,
    Endpoint,
    Callout,
    ParamsTable,
    ...components,
  };
}
