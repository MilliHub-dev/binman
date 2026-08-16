'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

const LINKS = [
  { id: 'services', label: 'Services' },
  { id: 'how', label: 'How it works' },
  { id: 'pricing', label: 'Pricing' },
];

/**
 * Scroll position, read through React's external-store API rather than
 * setState-in-an-effect. `passive` because this listener must never be able to
 * block scrolling on a low-end phone.
 */
const subscribeToScroll = (onChange: () => void) => {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
};

const PAST_HERO = 24;

/**
 * Floating pill navigation.
 *
 * Detached from the top edge so it reads as an object over the page rather than
 * a band welded to it. Transparent above the fold — the hero is dark and full
 * bleed — then it condenses into a glass pill once scrolled, which also gives
 * the links a legible ground over the white body beneath.
 *
 * Driver login deliberately lives in the footer, not here: it is a staff tool,
 * and putting it in the primary nav spends prime space on an audience of a
 * dozen people while implying to customers it is something they need.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>('');

  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > PAST_HERO,
    () => false,
  );

  const solid = scrolled || open;

  /** Highlights whichever section is currently in view. */
  useEffect(() => {
    const sections = LINKS.map((link) => document.getElementById(link.id)).filter(
      (element): element is HTMLElement => element !== null,
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The entry nearest the top of the viewport wins, so crossing a
        // boundary never briefly lights up two links at once.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  // Escape closes the sheet, and the page behind it must not scroll.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-3 md:pt-5">
        <nav
          aria-label="Main"
          className={`pointer-events-auto mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full py-2 pl-4 pr-2 transition-all duration-300 md:pl-6 ${
            solid
              ? 'border border-ink-200/80 bg-white/80 shadow-[0_8px_30px_-12px_rgba(11,26,38,0.25)] backdrop-blur-xl'
              : 'border border-white/15 bg-white/[0.06] backdrop-blur-md'
          }`}
        >
          <a href="#top" className="flex shrink-0 items-center gap-2" aria-label="BinMan, back to top">
            <Image src="/img/logo.png" alt="" width={36} height={36} className="h-8 w-8" priority />
            <span className="font-display text-[17px] font-black tracking-tight">
              <span className={solid ? 'text-brand' : 'text-white'}>Bin</span>
              <span className="text-leaf">Man</span>
            </span>
          </a>

          {/* Desktop links, with the section in view highlighted. */}
          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => {
              const isActive = active === link.id;
              return (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    aria-current={isActive ? 'true' : undefined}
                    className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? solid
                          ? 'bg-ink-100 text-ink-900'
                          : 'bg-white/15 text-white'
                        : solid
                          ? 'text-ink-600 hover:text-ink-900'
                          : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2">
            <a
              href="#download"
              className={`hidden shrink-0 rounded-full px-5 py-2.5 font-display text-sm font-bold transition-colors md:inline-flex ${
                solid ? 'bg-night text-white hover:bg-ink-800' : 'bg-white text-night hover:bg-white/90'
              }`}
            >
              Book a collection
            </a>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors md:hidden ${
                solid ? 'bg-ink-100' : 'bg-white/10'
              }`}
            >
              {/* A hamburger that morphs into a cross — steadier than swapping
                  glyphs, which jumps as the metrics change. */}
              <span className="relative block h-3.5 w-5" aria-hidden="true">
                <span
                  className={`absolute left-0 block h-0.5 w-full rounded-full transition-all duration-300 ${
                    solid ? 'bg-ink-900' : 'bg-white'
                  } ${open ? 'top-1.5 rotate-45' : 'top-0'}`}
                />
                <span
                  className={`absolute left-0 top-1.5 block h-0.5 w-full rounded-full transition-opacity duration-200 ${
                    solid ? 'bg-ink-900' : 'bg-white'
                  } ${open ? 'opacity-0' : 'opacity-100'}`}
                />
                <span
                  className={`absolute left-0 block h-0.5 w-full rounded-full transition-all duration-300 ${
                    solid ? 'bg-ink-900' : 'bg-white'
                  } ${open ? 'top-1.5 -rotate-45' : 'top-3'}`}
                />
              </span>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile sheet. Always rendered so it can transition; hidden from
          assistive tech and pulled out of the tab order when closed. */}
      <div
        id="mobile-menu"
        aria-hidden={!open}
        className={`fixed inset-0 z-40 md:hidden ${open ? '' : 'pointer-events-none'}`}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label="Close menu"
          onClick={close}
          className={`absolute inset-0 bg-night/70 backdrop-blur-sm transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div
          className={`absolute inset-x-3 top-20 origin-top rounded-3xl border border-ink-200 bg-white p-3 shadow-2xl transition-all duration-300 ${
            open ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
          }`}
        >
          <ul className="flex flex-col">
            {LINKS.map((link, index) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  onClick={close}
                  tabIndex={open ? 0 : -1}
                  style={{ transitionDelay: open ? `${60 + index * 45}ms` : '0ms' }}
                  className={`flex min-h-14 items-center justify-between rounded-2xl px-4 font-display text-lg font-bold tracking-tight transition-all duration-300 hover:bg-ink-50 ${
                    open ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                  }`}
                >
                  {link.label}
                  <span className="text-ink-300" aria-hidden="true">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <a
            href="#download"
            onClick={close}
            tabIndex={open ? 0 : -1}
            className="tap-target mt-2 flex items-center justify-center rounded-2xl bg-night font-display font-bold text-white"
          >
            Book a collection
          </a>
        </div>
      </div>
    </>
  );
}
