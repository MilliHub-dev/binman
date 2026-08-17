import Image from 'next/image';
import Link from 'next/link';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { Reveal } from '@/components/marketing/Reveal';
import {
  BinMark,
  BroomMark,
  ClockMark,
  ProofMark,
  RouteMap,
} from '@/components/marketing/Artwork';

/**
 * Landing page.
 *
 * Organising idea: **the route**. A collection truck's path threads the hero,
 * and the page follows the same journey — book, we come, it's gone, and here is
 * the proof. Structure encodes that sequence rather than decorating it.
 *
 * Statically generated: no request-time APIs, so it ships as HTML from the CDN.
 * The audience is on Nigerian mobile data, where a client-rendered hero costs
 * real seconds.
 */

/** Must stay in step with the service areas seeded in server/prisma/seed.ts. */
const AREAS = [
  'Ewet Housing Estate',
  'Shelter Afrique',
  'Osongama',
  'Aka Road',
  'Oron Road',
  'Nwaniba Road',
  'Ikot Ekpene Road',
  'Abak Road',
  'Itam',
];

const STEPS = [
  {
    title: 'Tell us what you have',
    body: 'Pick your address, the type of waste and roughly how much. Takes under a minute.',
  },
  {
    title: 'See the price, then pay',
    body: 'The full cost appears before you commit. No haggling at the gate, no surprise fees.',
  },
  {
    title: 'Track the truck',
    body: 'Watch your collection team approach, and get a nudge the moment they arrive.',
  },
  {
    title: 'Keep the receipt',
    body: 'Every collection is photographed, timed and GPS-stamped. It is in your history for good.',
  },
];

const PRICES = [
  { size: 'Small', bags: '1–2 bags', price: '1,500' },
  { size: 'Medium', bags: '3–5 bags', price: '2,500', popular: true },
  { size: 'Large', bags: '6+ bags', price: '4,000' },
  { size: 'Extra large', bags: 'Full truck load', price: '6,500' },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main id="top">
        {/* ── HERO ─────────────────────────────────────────────────────────
            Full-bleed night ground so the brand colours read as light against
            it, rather than another blue gradient on white. */}
        <section className="grain relative overflow-hidden bg-night">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-brand/25 blur-[120px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-56 -left-32 h-[30rem] w-[30rem] rounded-full bg-leaf/20 blur-[120px]"
          />

          <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-28 md:pb-28 md:pt-36">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[13px] font-semibold text-brand-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-leaf" />
                  Now collecting across Uyo
                </p>

                <h1 className="mt-6 font-display text-[clamp(2.75rem,8vw,5.25rem)] font-black leading-[0.94] tracking-[-0.035em] text-white">
                  Put it out.
                  <br />
                  <span className="text-leaf">We take it</span>
                  <br />
                  from there.
                </h1>

                <p className="mt-7 max-w-md text-lg leading-relaxed text-white/70">
                  Book a collection from your phone and our team comes to your door — on a
                  schedule you choose, at a price you see up front.
                </p>

                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="#download"
                    className="tap-target inline-flex items-center justify-center rounded-full bg-white px-8 font-display text-base font-extrabold text-night transition-transform hover:-translate-y-0.5"
                  >
                    Book a collection
                  </a>
                  <a
                    href="#how"
                    className="tap-target inline-flex items-center justify-center rounded-full border border-white/25 px-8 font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    See how it works
                  </a>
                </div>

                <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-white/10 pt-7">
                  {[
                    { k: 'From', v: '₦1,500' },
                    { k: 'Earliest slot', v: '7:00 AM' },
                    { k: 'Areas covered', v: String(AREAS.length) },
                  ].map((stat) => (
                    <div key={stat.k}>
                      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
                        {stat.k}
                      </dt>
                      <dd className="mt-1 font-display text-2xl font-extrabold text-white">{stat.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <RouteMap className="w-full max-w-lg justify-self-center" />
            </div>
          </div>

          {/* Coverage ticker — a moving band communicates "we're everywhere
              around you" far better than a static list of chips. */}
          <div className="relative border-y border-white/10 bg-white/[0.03] py-3.5">
            <div className="flex overflow-hidden">
              <ul className="ticker-track flex shrink-0 items-center gap-9 pr-9">
                {[...AREAS, ...AREAS, ...AREAS, ...AREAS].map((area, index) => (
                  <li
                    key={`${area}-${index}`}
                    className="flex shrink-0 items-center gap-9 font-display text-sm font-bold uppercase tracking-[0.18em] text-white/55"
                  >
                    {area}
                    <span className="h-1 w-1 rounded-full bg-leaf" aria-hidden="true" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── SERVICES ────────────────────────────────────────────────────
            Two big colour-blocked panels rather than a grid of small cards. */}
        <section id="services" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24">
          <Reveal>
            <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
              What we do
            </p>
            <h2 className="mt-4 max-w-2xl text-balance font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
              Two services. One number to call.
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <Reveal>
              <article className="group relative h-full overflow-hidden rounded-3xl bg-night p-9 text-white md:p-11">
                <BinMark className="h-14 w-14 text-leaf" />
                <h3 className="mt-7 font-display text-3xl font-extrabold tracking-tight">
                  Waste collection
                </h3>
                <p className="mt-3 max-w-sm leading-relaxed text-white/65">
                  Household, food, plastic, cardboard, garden and commercial waste. We bring the
                  bags and the muscle.
                </p>
                <ul className="mt-7 space-y-3 border-t border-white/10 pt-7">
                  {['One bag to a full truck load', 'Slots from 7:00 AM daily', 'Sorted for recycling'].map(
                    (point) => (
                      <li key={point} className="flex items-start gap-3 text-[15px] text-white/80">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf" />
                        {point}
                      </li>
                    ),
                  )}
                </ul>
                <p className="mt-8 font-display text-sm font-bold uppercase tracking-[0.14em] text-leaf">
                  From ₦1,500
                </p>
              </article>
            </Reveal>

            <Reveal delay={90}>
              <article className="relative h-full overflow-hidden rounded-3xl border border-ink-200 bg-white p-9 md:p-11">
                <BroomMark className="h-14 w-14 text-brand" />
                <h3 className="mt-7 font-display text-3xl font-extrabold tracking-tight">Home cleaning</h3>
                <p className="mt-3 max-w-sm leading-relaxed text-ink-600">
                  Regular, deep, office and move-out cleans by vetted staff who turn up when they
                  say they will.
                </p>
                <ul className="mt-7 space-y-3 border-t border-ink-200 pt-7">
                  {['1 to 4+ bedroom homes', 'Offices, shops and event spaces', 'Move-in and move-out'].map(
                    (point) => (
                      <li key={point} className="flex items-start gap-3 text-[15px] text-ink-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        {point}
                      </li>
                    ),
                  )}
                </ul>
                <p className="mt-8 font-display text-sm font-bold uppercase tracking-[0.14em] text-brand">
                  From ₦8,000
                </p>
              </article>
            </Reveal>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────────────────────
            Numbered because it genuinely is a sequence, and drawn as stops on
            a line to carry the route motif through. */}
        <section id="how" className="scroll-mt-24 border-y border-ink-200 bg-white py-24">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal>
              <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
                How it works
              </p>
              <h2 className="mt-4 max-w-2xl text-balance font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
                Four stops from full bin to empty.
              </h2>
            </Reveal>

            <ol className="mt-14 grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <Reveal key={step.title} delay={index * 80}>
                  <li className="relative">
                    {/* The connector continues the route line between stops. */}
                    {index < STEPS.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-12 top-5 hidden h-0.5 w-[calc(100%-2rem)] bg-[repeating-linear-gradient(90deg,var(--color-ink-300)_0_6px,transparent_6px_14px)] lg:block"
                      />
                    ) : null}
                    <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-night font-display text-lg font-extrabold text-leaf">
                      {index + 1}
                    </span>
                    <h3 className="mt-5 font-display text-lg font-bold tracking-tight">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{step.body}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ── PROOF ───────────────────────────────────────────────────────
            The genuine differentiator, given its own section rather than a
            bullet: nobody else in this market photographs every collection. */}
        <section className="mx-auto max-w-6xl px-5 py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <Reveal>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { Icon: ProofMark, label: 'Photographed', tint: 'text-brand', bg: 'bg-brand-50' },
                  { Icon: ClockMark, label: 'Timed', tint: 'text-leaf-600', bg: 'bg-leaf-50' },
                ].map(({ Icon, label, tint, bg }) => (
                  <div key={label} className={`rounded-2xl ${bg} p-7`}>
                    <Icon className={`h-12 w-12 ${tint}`} />
                    <p className="mt-5 font-display text-lg font-bold tracking-tight">{label}</p>
                  </div>
                ))}
                <div className="col-span-2 rounded-2xl bg-night p-7 text-white">
                  <p className="font-display text-4xl font-black tracking-tight text-leaf">GPS</p>
                  <p className="mt-2 text-white/65">
                    Stamped at the kerb, so there is never a question about whether we came.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
                  Why BinMan
                </p>
                <h2 className="mt-4 text-balance font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
                  Proof, not promises.
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-ink-600">
                  Every collection our team completes is photographed at your kerb, stamped with
                  the time and the location, and saved to your booking history.
                </p>
                <p className="mt-4 text-lg leading-relaxed text-ink-600">
                  If a collection is ever disputed, there is a record — not an argument. That
                  record is why our drivers cannot close a job without it.
                </p>
                <a
                  href="#download"
                  className="mt-8 inline-flex items-center gap-2 font-display text-base font-bold text-brand hover:text-brand-600"
                >
                  Book your first collection
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── PRICING ─────────────────────────────────────────────────────
            A price ladder, not four identical cards — size drives the visual
            weight so the scale is legible at a glance. */}
        <section id="pricing" className="scroll-mt-24 border-y border-ink-200 bg-white py-24">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal>
              <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
                Pricing
              </p>
              <h2 className="mt-4 max-w-2xl text-balance font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
                Priced by the load. Shown before you pay.
              </h2>
              <p className="mt-5 max-w-xl leading-relaxed text-ink-600">
                A ₦500 service fee is added at checkout, and a few outer areas carry a small
                surcharge — all of it visible before payment, never after.
              </p>
            </Reveal>

            <div className="mt-14 divide-y divide-ink-200 border-y border-ink-200">
              {PRICES.map((tier, index) => (
                <Reveal key={tier.size} delay={index * 60}>
                  <div
                    className={`flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 py-7 ${
                      tier.popular ? 'bg-brand-50/60 px-5 -mx-5' : ''
                    }`}
                  >
                    <div className="flex items-baseline gap-4">
                      <h3 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
                        {tier.size}
                      </h3>
                      {tier.popular ? (
                        <span className="rounded-full bg-brand px-2.5 py-1 font-display text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">
                          Most booked
                        </span>
                      ) : null}
                    </div>
                    <p className="text-ink-500">{tier.bags}</p>
                    <p className="font-display text-3xl font-black tracking-tight tabular-nums md:text-4xl">
                      <span className="text-ink-400">₦</span>
                      {tier.price}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <section id="download" className="scroll-mt-24 px-5 py-24">
          <Reveal>
            <div className="grain relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-night px-8 py-16 text-center md:px-16 md:py-20">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-leaf/25 blur-[110px]"
              />
              <div className="relative">
                <h2 className="mx-auto max-w-2xl text-balance font-display text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.02] tracking-[-0.035em] text-white">
                  Clean homes. Cleaner communities.
                </h2>
                <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-white/70">
                  Download BinMan to book a collection, track your team and set up a weekly
                  pickup. Or message us on WhatsApp and book there.
                </p>
                <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
                  <a
                    href="#"
                    className="tap-target inline-flex items-center justify-center rounded-full bg-white px-8 font-display text-base font-extrabold text-night transition-transform hover:-translate-y-0.5"
                  >
                    Download the app
                  </a>
                  <a
                    href="https://wa.me/2349038912979"
                    className="tap-target inline-flex items-center justify-center rounded-full border border-white/25 px-8 font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Book on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <Image src="/img/logo.png" alt="" width={36} height={36} className="h-9 w-9" />
              <span className="font-display text-lg font-black tracking-tight">
                <span className="text-brand">Bin</span>
                <span className="text-leaf-600">Man</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-500">
              Waste collection and home services, built for Uyo.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-ink-400">
                Company
              </p>
              <ul className="mt-3 space-y-2 text-ink-600">
                <li>
                  <a href="#services" className="hover:text-brand">
                    Services
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-brand">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-ink-400">
                Contact
              </p>
              <ul className="mt-3 space-y-2 text-ink-600">
                <li>
                  <a href="tel:+2349038912979" className="hover:text-brand">
                    0903 891 2979
                  </a>
                </li>
                <li>
                  <a href="mailto:info.binman@gmail.com" className="hover:text-brand">
                    info.binman@gmail.com
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-ink-400">
                Team
              </p>
              <ul className="mt-3 space-y-2 text-ink-600">
                <li>
                  <Link href="/driver" className="hover:text-brand">
                    Driver login
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-ink-100 px-5 py-5">
          <p className="mx-auto max-w-6xl text-xs text-ink-400">
            © {new Date().getFullYear()} BinMan. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}
