[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyDiagnosticsResult

# Type Alias: JourneyDiagnosticsResult\<TStepId, TEventType\>

```ts
type JourneyDiagnosticsResult<TStepId, TEventType> = {
  issues: JourneyDiagnosticsIssue<TStepId, TEventType>[];
  summary: JourneyDiagnosticsSummary;
};
```

Defined in: [packages/core/src/types/diagnostics.types.ts:46](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L46)

Result returned by `getJourneyDiagnostics()`.

## Type Parameters

| Type Parameter                  |
| ------------------------------- |
| `TStepId` _extends_ `string`    |
| `TEventType` _extends_ `string` |

## Properties

### issues

```ts
issues: (JourneyDiagnosticsIssue < TStepId, TEventType > []);
```

Defined in: [packages/core/src/types/diagnostics.types.ts:47](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L47)

---

### summary

```ts
summary: JourneyDiagnosticsSummary;
```

Defined in: [packages/core/src/types/diagnostics.types.ts:48](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L48)
