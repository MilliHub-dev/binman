import Link from 'next/link';
import type { LegalSection } from '@/lib/legal';
import { LEGAL_LAST_UPDATED } from '@/lib/legal';

/**
 * A legal document, on the web.
 *
 * These exist publicly for two reasons beyond good manners: Google Play will not
 * accept an app without a privacy policy at a reachable URL, and someone who
 * wants to read the terms before installing anything has nowhere else to look.
 *
 * The wording is the same text the app shows, extracted from it rather than
 * rewritten — see src/lib/legal.ts.
 */
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8">
      <Link href="/" className="text-sm font-semibold text-ink-500 hover:text-brand">
        ← BinMan
      </Link>

      <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
        {title}
      </h1>

      <p className="mt-2 text-sm text-ink-500">
        Last updated{' '}
        <time dateTime={LEGAL_LAST_UPDATED}>
          {new Date(LEGAL_LAST_UPDATED).toLocaleDateString('en-NG', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </time>
      </p>

      <p className="mt-6 text-lg leading-relaxed text-ink-700">{intro}</p>

      <div className="mt-10 space-y-10">
        {sections.map((section, index) => (
          <section key={section.heading}>
            <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">
              <span className="text-ink-400">{index + 1}.</span> {section.heading}
            </h2>

            {section.body?.map((paragraph) => (
              <p key={paragraph} className="mt-3 leading-relaxed text-ink-700">
                {paragraph}
              </p>
            ))}

            {section.bullets ? (
              <ul className="mt-3 space-y-2">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 leading-relaxed text-ink-700">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </main>
  );
}
