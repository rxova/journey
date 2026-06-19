[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyDiagnosticsIssueCode

# Type Alias: JourneyDiagnosticsIssueCode

```ts
type JourneyDiagnosticsIssueCode =
  | "cycle-detected"
  | "dead-end-step"
  | "no-terminal-path"
  | "shadowed-transition"
  | "unreachable-step";
```

Defined in: [packages/core/src/types/diagnostics.types.ts:4](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L4)

Structural diagnostic issue codes returned by journey diagnostics.
