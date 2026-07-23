import { type AnchorHTMLAttributes, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Table, TableBody, TableHead, TableHeaderCell, TableCell, TableRow } from "../ui/Table";
import { SeverityBadge } from "../ui/Badge";
import { SEVERITY_ORDER, severityStyle } from "../../lib/severity";
import { cn } from "../../lib/utils";

// Matches a table cell that is EXACTLY a severity word (its raw key like
// "CRITICAL" or its display label like "Critical") — never a substring
// match inside a longer sentence, so this only ever fires for the kind of
// single-word severity cell the backend prompt asks the model to produce
// in comparison tables, not for prose that happens to mention a severity.
const SEVERITY_WORD_LOOKUP = new Map<string, string>();
for (const severity of SEVERITY_ORDER) {
  SEVERITY_WORD_LOOKUP.set(severity.toLowerCase(), severity);
  SEVERITY_WORD_LOOKUP.set(severityStyle(severity).label.toLowerCase(), severity);
}

function plainTextOf(children: ReactNode): string | null {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children) && children.length === 1) return plainTextOf(children[0]);
  return null;
}

function severityForCell(children: ReactNode): string | null {
  const text = plainTextOf(children)?.trim().toLowerCase();
  if (!text) return null;
  return SEVERITY_WORD_LOOKUP.get(text) ?? null;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-2 text-lg font-semibold text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 border-t border-border pt-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-sm font-semibold text-foreground">{children}</h3>,
  hr: () => <hr className="my-4 border-border" />,
  p: ({ children }) => <p className="mb-2 text-sm leading-relaxed text-foreground last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 text-sm text-foreground last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 text-sm text-foreground last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2" {...props}>
      {children}
    </a>
  ),
  code: ({ children, className }) => (
    <code className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8em] text-foreground", className)}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs last:mb-0">{children}</pre>
  ),
  table: ({ children }) => <Table className="mb-2 text-xs">{children}</Table>,
  thead: ({ children }) => <TableHead>{children}</TableHead>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableHeaderCell className="whitespace-nowrap">{children}</TableHeaderCell>,
  td: ({ children }) => {
    const severity = severityForCell(children);
    return (
      <TableCell className="whitespace-normal">
        {severity ? <SeverityBadge severity={severity} /> : children}
      </TableCell>
    );
  },
};

/** Renders the Executive Intelligence answer's structured markdown (the
 * backend prompt now asks for `# Executive Summary` / `## Key Findings` /
 * etc., GFM tables, and bold figures) through real components instead of
 * a raw `whitespace-pre-wrap` string — see prompts.py rule 3. Tables reuse
 * the app's existing `components/ui/Table.tsx` family so styling/overflow
 * behavior stays consistent everywhere else a table appears. */
export function ExecutiveMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
