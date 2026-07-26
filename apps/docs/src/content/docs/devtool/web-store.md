---
title: "Web Store Readiness"
---

This repo includes a web-store-ready baseline for Chrome extension packaging.

## Current Status

The extension is available on Chrome Web Store:

- https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm

## Privacy Policy URL

Use this direct URL in the Chrome Web Store listing:

- `https://rxova.org/docs/devtool/privacy-policy`

## Manifest Baseline

- Manifest V3
- background service worker
- explicit `permissions` and `host_permissions`
- static icons

## Security Model

- no remote code execution
- no runtime remote script injection
- strict typed protocol for message exchange
- app-side CSP does not need `unsafe-inline`, `unsafe-eval`, remote script hosts, or browser extension origins for the bridge

## Submission Asset Checklist

Replace placeholders before publishing:

- `apps/devtools/public/icons/icon16.png`
- `apps/devtools/public/icons/icon32.png`
- `apps/devtools/public/icons/icon48.png`
- `apps/devtools/public/icons/icon128.png`
- `apps/devtools/public/screenshots/panel-placeholder.png`

Current screenshots available:

- `apps/devtools/public/screenshots/panel-overview.png`
- `apps/devtools/public/screenshots/panel-commands.png`
- `apps/devtools/public/screenshots/panel-logs.png`

## Current Screenshot Preview

Overview:

![Journey Devtools Overview](../../../assets/devtool/panel-overview.png)

Commands:

![Journey Devtools Commands](../../../assets/devtool/panel-commands.png)

Logs:

![Journey Devtools Logs](../../../assets/devtool/panel-logs.png)

## Suggested Store Listing Structure

- Title: `Rxova Journey Devtools`
- Summary: `Inspect and control Journey machines from Chrome DevTools`
- Description sections:
  - Features
  - Privacy statement
  - Setup steps
  - Support links

## Release Sanity Checks

1. Validate the packaged extension artifact from CI/release pipeline.
2. Validate final screenshots and listing copy match current panel behavior.
3. Verify command paths and error handling.
4. Validate no unexpected permissions in final manifest.
