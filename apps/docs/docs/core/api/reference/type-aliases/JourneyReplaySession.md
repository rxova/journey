[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyReplaySession

# Type Alias: JourneyReplaySession\<TContext, TStepId, TEventMap\>

```ts
type JourneyReplaySession<TContext, TStepId, TEventMap> = {
  entries: JourneyReplayEntry<TContext, TStepId, TEventMap>[];
  initialSnapshot: JourneySnapshot<TContext, TStepId> | null;
  truncated: boolean;
  version: 1;
};
```

Defined in: [packages/core/src/types/replay.types.ts:34](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L34)

Full replay session captured from a journey machine.

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |

## Properties

### entries

```ts
entries: (JourneyReplayEntry < TContext, TStepId, TEventMap > []);
```

Defined in: [packages/core/src/types/replay.types.ts:41](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L41)

---

### initialSnapshot

```ts
initialSnapshot: JourneySnapshot<TContext, TStepId> | null;
```

Defined in: [packages/core/src/types/replay.types.ts:40](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L40)

---

### truncated

```ts
truncated: boolean;
```

Defined in: [packages/core/src/types/replay.types.ts:42](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L42)

---

### version

```ts
version: 1;
```

Defined in: [packages/core/src/types/replay.types.ts:39](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L39)
