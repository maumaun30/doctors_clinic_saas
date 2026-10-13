import { AlertTriangleIcon } from "lucide-react";
import { LEGAL } from "@/lib/legal";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/** A legal document: title, effective date, contents list, numbered sections. */
export function LegalDoc({ title, intro, sections }: {
  title: string; intro: React.ReactNode; sections: LegalSection[];
}) {
  return (
    <article className="card px-5 py-7 md:px-10 md:py-10">
      {LEGAL.draft && (
        <div role="note" className="mb-6 flex gap-2 rounded-lg border border-(--warning)/40 bg-(--warning-subtle) px-3 py-2 text-sm">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-(--warning)" />
          <span>Draft. Bracketed details are still to be filled in, and this document has not yet been reviewed by legal counsel.</span>
        </div>
      )}
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Effective {LEGAL.effectiveDate}</p>
      <div className="legal-body mt-6">{intro}</div>

      <nav aria-label="Contents" className="my-8 rounded-lg bg-muted/50 px-4 py-3">
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Contents</p>
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}><a href={`#${s.id}`} className="hover:underline">{i + 1}. {s.title}</a></li>
          ))}
        </ol>
      </nav>

      <div className="legal-body grid gap-8">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-6">
            <h2>{i + 1}. {s.title}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </article>
  );
}
