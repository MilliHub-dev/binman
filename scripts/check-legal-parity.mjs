/**
 * Fails if the app's legal text and the website's have drifted apart.
 *
 * The two live in separate packages with separate bundlers, so they cannot
 * share a module without restructuring the repository. Duplicated text is the
 * pragmatic answer, but silently divergent terms are not: someone agrees in the
 * app and later reads the website, and those must say the same thing.
 *
 *   node scripts/check-legal-parity.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Anchored to this file, not the working directory — the script is run both
 * from the repository root and from webapp/ via npm, and relative paths would
 * resolve differently in each.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Pulls the SECTIONS array literal out of a source file, verbatim. */
const extract = (path, marker) => {
  const source = readFileSync(join(repoRoot, path), 'utf8');
  const at = source.indexOf(marker);
  if (at === -1) throw new Error(`No "${marker}" in ${path}`);

  let i = source.indexOf('[', at + marker.length - 1);
  const start = i;
  let depth = 0;
  for (; i < source.length; i += 1) {
    if (source[i] === '[') depth += 1;
    else if (source[i] === ']') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(start, i + 1);
};

/** Only the wording matters — formatting and interpolation names do not. */
const normalise = (block) =>
  [...block.matchAll(/'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/gs)]
    .map((m) => (m[1] ?? m[2]).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

const pairs = [
  {
    name: 'Terms & conditions',
    app: ['mobile/src/screens/legal/TermsScreen.tsx', 'const SECTIONS: LegalSection[] = '],
    web: ['webapp/src/lib/legal.ts', 'export const TERMS_SECTIONS: LegalSection[] = '],
  },
  {
    name: 'Privacy policy',
    app: ['mobile/src/screens/legal/PrivacyScreen.tsx', 'const SECTIONS: LegalSection[] = '],
    web: ['webapp/src/lib/legal.ts', 'export const PRIVACY_SECTIONS: LegalSection[] = '],
  },
];

let failed = false;

for (const { name, app, web } of pairs) {
  const inApp = normalise(extract(...app));
  const onWeb = normalise(extract(...web));

  if (inApp === onWeb) {
    console.log(`  ok       ${name} — app and website match`);
    continue;
  }

  failed = true;
  console.error(`  DRIFTED  ${name}`);

  const a = inApp.split('\n');
  const b = onWeb.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) {
      console.error(`     first difference at line ${i + 1}`);
      console.error(`       app: ${a[i] ?? '(missing)'}`);
      console.error(`       web: ${b[i] ?? '(missing)'}`);
      break;
    }
  }
}

if (failed) {
  console.error('\nUpdate both copies, or regenerate the website\'s from the app\'s.');
  process.exit(1);
}
