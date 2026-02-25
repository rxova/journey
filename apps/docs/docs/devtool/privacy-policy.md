---
title: Privacy Policy
sidebar_position: 9
---

This Privacy Policy applies to the **Rxova Journey Devtools** Chrome extension (item ID: `bkmdccobpcagbmknjmmhbabcfphinjcm`).

Last updated: **February 25, 2026**

## What This Extension Does

Rxova Journey Devtools is a Chrome DevTools extension used to inspect and control Journey machines running in the page you are debugging.

## Data We Process

When the extension is active for a tab, it may process:

- Journey machine metadata (for example: `machineId`, label, app name)
- Journey machine snapshots and event/command results
- Runtime debugging data shown in the DevTools panel

If snapshots or events include personal data, that data is present because your app implementation chose to include it in its own state, not because this extension requires personal data to operate.

## How We Use Data

We use this data only to provide debugging functionality in the DevTools panel, including:

- showing machine status and snapshots
- showing event/command logs
- sending user-triggered debug commands to the inspected page

## Data Sharing and Sale

- We do **not** sell personal data.
- We do **not** use data for advertising.
- We do **not** share extension-collected data with third parties for independent use.

## Network Transfer

The extension does **not** transmit Journey snapshot/event payloads to Rxova servers.

The extension communicates locally between:

- the inspected page
- the content script
- the background service worker
- the DevTools panel

## Data Storage and Retention

- Data handled by the extension is kept in browser memory for active debugging.
- The panel keeps a bounded in-memory log (up to 2000 log entries per machine).
- Data is cleared when tabs reload/close or when extension runtime state is reset.
- The extension does **not** use `chrome.storage` for Journey payload persistence.

## Permissions We Request

- `activeTab`, `scripting` to enable DevTools-driven inspection/injection
- host permissions for local development targets:
  - `http://localhost/*`
  - `https://localhost/*`
  - `http://127.0.0.1/*`
  - `https://127.0.0.1/*`
- optional host permissions (`http://*/*`, `https://*/*`) only when a user grants broader access

## Security Practices

- Manifest V3 extension architecture
- typed protocol/message validation
- origin checks for page message handling
- no remote code execution or remote script loading

## Your Choices

You can stop data processing by:

- closing the DevTools panel
- disabling or uninstalling the extension
- removing optional site access permissions in Chrome
- disabling your app-side bridge integration

## Changes To This Policy

We may update this policy as the extension changes. Updates are posted on this page with a revised "Last updated" date.

## Contact

For issues, use GitHub:

- [https://github.com/rxova/journey/issues](https://github.com/rxova/journey/issues)

For privacy questions, email:

- `rxova@proton.me`
