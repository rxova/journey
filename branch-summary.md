# Branch Summary: feat/fix-docs-search

## Search index fallback

- Explicitly annotate the docs search plugin configuration so the named plugin used in this site becomes the default when the preferred version is derived. The `docsPluginIdForPreferredVersion` option now points at `core`, preventing Docusaurus from assuming the default unnamed docs plugin exists.

## Home feature carousel tweaks

- Switched the cards from fixed heights to `min-height` values so taller content no longer overflows, and reset height constraints at mobile breakpoints to allow cards to wrap naturally.
- Reduced typography sizes across the carousel (headlines scaled from `text-2xl`/`text-lg` to `text-xl`/`text-base` with responsive fallbacks) so the text reads better on smaller viewports, while maintaining responsive overrides for larger screens.

## Navbar logo component

- Added a custom `Navbar/Logo` theme component that renders a linked brand block with either a simple `<img>` or a `<ThemedImage>` when the logo supplies both light and dark sources. The component respects configured `href`, `target`, `alt`, sizing, and class names, falling back to the site title when no logo alt text is provided.
