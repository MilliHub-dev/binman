'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Reveals its children once they scroll into view.
 *
 * The hidden state is applied from JS rather than in the markup, so if the
 * script never runs the content is simply visible — a scroll animation must
 * never be the reason someone cannot read the page.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  /** Milliseconds, for staggering siblings. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      element.dataset.shown = 'true';
      return;
    }

    element.classList.add('reveal');
    element.style.transitionDelay = `${delay}ms`;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            element.dataset.shown = 'true';
            // One-shot: re-animating on every scroll past is noise.
            observer.unobserve(element);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
