import type { MDXComponents } from "mdx/types";
import type { ReactElement } from "react";
import { Callout, CodeBlock, Endpoint, ParamsTable } from "@/components/docs/mdx";
import { EnvironmentTable } from "@/components/docs/EnvironmentTable";
import { resolveDocUrls } from "@/config/docs-urls";

function getPreText(children: React.ReactNode): { code: string; language?: string } | null {
  if (!children || typeof children !== "object") return null;
  const element = children as ReactElement<{ className?: string; children?: React.ReactNode }>;
  if (element.type !== "code") return null;
  const className = element.props.className ?? "";
  const match = /language-(\w+)/.exec(className);
  const raw = element.props.children;
  if (typeof raw !== "string") return null;
  return { code: raw, language: match?.[1] };
}

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
    thead: (props) => <thead className="bg-slate-50" {...props} />,
    tbody: (props) => <tbody className="divide-y divide-slate-100 bg-white" {...props} />,
    tr: (props) => <tr {...props} />,
    th: (props) => (
      <th className="px-4 py-2 text-left font-semibold text-slate-700" {...props} />
    ),
    td: (props) => <td className="px-4 py-2 text-slate-600" {...props} />,
    pre: (props) => {
      const parsed = getPreText(props.children);
      if (parsed) {
        return (
          <CodeBlock language={parsed.language ?? "text"}>
            {resolveDocUrls(parsed.code)}
          </CodeBlock>
        );
      }
      return (
        <pre className="not-prose my-6 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-100">
          {props.children}
        </pre>
      );
    },
    code: (props) => {
      const isBlock = typeof props.className === "string" && props.className.includes("language-");
      if (isBlock) return <code {...props} />;
      return (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-800" {...props} />
      );
    },
    CodeBlock,
    Endpoint,
    Callout,
    ParamsTable,
    EnvironmentTable,
    ...components,
  };
}
