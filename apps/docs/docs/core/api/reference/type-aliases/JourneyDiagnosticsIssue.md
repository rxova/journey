[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyDiagnosticsIssue

# Type Alias: JourneyDiagnosticsIssue\<TStepId, TEventType\>

```ts
type JourneyDiagnosticsIssue<TStepId, TEventType> = {
  code: JourneyDiagnosticsIssueCode;
  eventType?: TEventType;
  from?: TStepId | JourneyBuiltInFrom;
  label?: string;
  message: string;
  severity: JourneyDiagnosticsIssueSeverity;
  stepId?: TStepId;
  steps?: readonly TStepId[];
  transitionId?: string;
};
```

Defined in: [packages/core/src/types/diagnostics.types.ts:20](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L20)

A single diagnostics issue discovered while analyzing a journey definition.

## Type Parameters

| Type Parameter                  |
| ------------------------------- |
| `TStepId` _extends_ `string`    |
| `TEventType` _extends_ `string` |

## Properties

### code

```ts
code: JourneyDiagnosticsIssueCode;
```

Defined in: [packages/core/src/types/diagnostics.types.ts:21](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L21)

---

### eventType?

```ts
optional eventType?: TEventType;
```

Defined in: [packages/core/src/types/diagnostics.types.ts:26](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L26)

---

### from?

```ts
optional from?: TStepId | JourneyBuiltInFrom;
```

Defined in: [packages/core/src/types/diagnostics.types.ts:25](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L25)

---

### label?

```ts
optional label?: string;
```

Defined in: [packages/core/src/types/diagnostics.types.ts:28](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L28)

---

### message

```ts
message: string;
```

Defined in: [packages/core/src/types/diagnostics.types.ts:23](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L23)

---

### severity

```ts
severity: JourneyDiagnosticsIssueSeverity;
```

Defined in: [packages/core/src/types/diagnostics.types.ts:22](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L22)

---

### stepId?

```ts
optional stepId?: TStepId;
```

Defined in: [packages/core/src/types/diagnostics.types.ts:24](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L24)

---

### steps?

```ts
optional steps?: readonly TStepId[];
```

Defined in: [packages/core/src/types/diagnostics.types.ts:29](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L29)

---

### transitionId?

```ts
optional transitionId?: string;
```

Defined in: [packages/core/src/types/diagnostics.types.ts:27](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/diagnostics.types.ts#L27)
