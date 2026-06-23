---
"@rxova/journey-react": minor
---

Add `useJourney(factory)` — a hook that owns a journey runtime for the lifetime of the calling
component.

The factory (any `create*Journey` result) runs **once**, even under React StrictMode's double-invoke,
and the runtime is **disposed automatically on unmount**. This is the safe, low-ceremony way to own a
per-instance or request-scoped flow — cards, modals, route boundaries, and especially Next.js App
Router / RSC `"use client"` components, where a module-level `createJourney(...)` singleton would be
shared across every request. It replaces the manual `useMemo(() => createJourney(...), [])` +
`disposeOnUnmount` pattern (which could leak the previous instance when recreated). Reset by remounting
the owner with a React `key`.

```tsx
"use client";
function CheckoutCard({ customerId }: { customerId: string }) {
  const journey = useJourney(() =>
    createJourney({ ...definition, context: { ...definition.context, customerId } })
  );
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
}
```

The React docs now lead with this ownership model (with a decision guide for SPA vs. SSR/RSC).
