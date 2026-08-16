/**
 * Purpose-drawn SVG artwork.
 *
 * The mobile app's onboarding illustrations are app art — phone mockups and
 * character scenes — and reusing them on the web made the site look like a
 * screenshot gallery. These are drawn for this page instead: flat, brand-tinted
 * geometry that scales to any width and costs a few hundred bytes.
 *
 * All decorative, so each is hidden from assistive tech; meaning lives in the
 * surrounding copy.
 */

/** The collection route threading the hero — the page's organising motif. */
export function RouteMap({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 420"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* City blocks, faint, as ground */}
      <g opacity="0.16" fill="#93D3F9">
        <rect x="34" y="238" width="58" height="120" rx="4" />
        <rect x="104" y="196" width="44" height="162" rx="4" />
        <rect x="392" y="214" width="52" height="144" rx="4" />
        <rect x="456" y="256" width="38" height="102" rx="4" />
        <rect x="222" y="150" width="40" height="88" rx="4" />
      </g>

      {/* The route itself: a static under-stroke plus an animated dash on top */}
      <path
        d="M46 352 C 130 352, 128 236, 208 236 S 300 122, 372 122 S 470 190, 486 254"
        stroke="#0A5695"
        strokeWidth="16"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M46 352 C 130 352, 128 236, 208 236 S 300 122, 372 122 S 470 190, 486 254"
        stroke="#8CC832"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="14 18"
        className="route-dash"
      />

      {/* Stops along the route */}
      {[
        [46, 352],
        [208, 236],
        [372, 122],
        [486, 254],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="13" fill="#0B1A26" />
          <circle cx={cx} cy={cy} r="6" fill="#8CC832" />
        </g>
      ))}

      {/* Truck at the head of the route */}
      <g transform="translate(444, 206)">
        <rect x="0" y="0" width="58" height="34" rx="6" fill="#189CF0" />
        <rect x="42" y="9" width="26" height="25" rx="5" fill="#E8F5FE" />
        <circle cx="16" cy="40" r="8" fill="#0B1A26" />
        <circle cx="56" cy="40" r="8" fill="#0B1A26" />
      </g>
    </svg>
  );
}

/** A wheelie bin, used as the marker on service panels. */
export function BinMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" focusable="false">
      <rect x="14" y="8" width="36" height="6" rx="3" fill="currentColor" opacity="0.55" />
      <path d="M16 18h32l-3 36a4 4 0 0 1-4 3.6H23a4 4 0 0 1-4-3.6L16 18Z" fill="currentColor" />
      <path d="M27 28v18M37 28v18" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}

/** A broom, for the cleaning panel. */
export function BroomMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" focusable="false">
      <path d="M42 6 26 30" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
      <path d="M14 44 30 24l14 10-10 22-20-12Z" fill="currentColor" />
      <path
        d="M17 49 12 58M25 53 21 61M33 56 30 62"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

/** Camera + pin, marking the proof-of-collection guarantee. */
export function ProofMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" focusable="false">
      <rect x="6" y="18" width="42" height="32" rx="6" fill="currentColor" />
      <circle cx="27" cy="34" r="9" fill="#0B1A26" opacity="0.35" />
      <circle cx="27" cy="34" r="4.5" fill="#fff" opacity="0.9" />
      <path d="M20 18l4-6h10l4 6" fill="currentColor" />
      <path
        d="M50 22c5 0 9 4 9 9 0 6.5-9 15-9 15s-9-8.5-9-15c0-5 4-9 9-9Z"
        fill="#8CC832"
      />
      <circle cx="50" cy="31" r="3.4" fill="#0B1A26" />
    </svg>
  );
}

/** Clock face, for the scheduling panel. */
export function ClockMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" focusable="false">
      <circle cx="32" cy="34" r="24" fill="currentColor" />
      <path d="M32 20v15l10 6" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 6h20" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
