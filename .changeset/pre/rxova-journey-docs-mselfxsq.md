---
"@rxova/journey-docs": minor
---

Rebuild the docs landing page as a marketing page.

The Docusaurus migration transcribed the old homepage rather than redesigning it, so the page still opened with a release announcement — "We did it!", a confetti modal, and a persistent "Reopen the 1.0.0rc celebration" link — and four of its sections carried the old teal-and-navy palette as ~50 hardcoded colour literals, on a site whose accent has been violet since it adopted `@rxova/brand`. Below the fold it was four stacked `CardGrid`s of unstyled Starlight cards; the carousel's cards used `--sl-color-black`, which the brand maps to `--rx-bg`, so their fill was the page colour and only a hairline showed.

`CelebrationModal`, `FeatureCarousel`, `ReleaseHighlights` and `InstallTypewriter` are gone, and with them every hardcoded colour on the page and the `canvas-confetti` dependency. In their place, section components in `src/components/home/` built the way the react-inputs landing is built: brand tokens only, scoped styles, no Tailwind, `prefers-reduced-motion` on every animation, and server-rendered content so the page reads with JS off.

The page now runs hero → CTA → quickstart → live demo → three modes → value grid → proof → DevTools → React → CTA. Two parts are worth calling out:

- **The demo is a real machine.** It drives an actual `@rxova/journey-core` instance from a plain `<script>` — no React, no `@astrojs/react` — through a branching checkout, with the snapshot and `history.timeline` rendered beside it. Stepping back and changing the plan re-evaluates the guard on the way forward, which is the one thing about the timeline that prose has never conveyed well. Using core rather than the bindings is the point: it demonstrates the framework-agnostic claim instead of asserting it.
- **The proof band measures itself.** `src/lib/proof.ts` runs `size-limit --json` against each package's built output at build time and reads the real byte counts, and parses the coverage floor out of `vitest.config.ts`. Nothing on the page restates a number from prose. It immediately caught one: the bridge measures 3.13 kB, not the 3.2 kB the README claims. When a package has not been built the figure falls back to that package's size-limit budget and renders as a ceiling (`≤ 3.5 kB`) rather than a measurement — the docs app now depends on all three packages so turbo's `^build` builds them first, and the fallback should never fire in CI.

`@rxova/brand` moves 0.2.0 → 0.11.0, which brings the fuller shared footer, the `Rxova` wordmark casing, and the bfcache theme resync.

Also fixed while here: the hero no longer sits in a two-column grid whose image column this page never fills, and a `--rx-on-primary` token keeps text on a violet fill above AA in dark mode, where the brand lightens `--rx-primary` for legibility as text.
