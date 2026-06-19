[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyStepDefinition

# Type Alias: JourneyStepDefinition\<TContext, TStepId, TEventMap, TStepMeta, THandlers\>

```ts
type JourneyStepDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers> = {
  meta?: TStepMeta;
  onEnter?: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;
  onLeave?: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;
};
```

Defined in: [packages/core/src/types/journey.types.ts:123](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L123)

Step definition with optional metadata and lifecycle callbacks.

## Type Parameters

| Type Parameter                                                   | Default type                                |
| ---------------------------------------------------------------- | ------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | [`JourneyJsonObject`](JourneyJsonObject.md) |
| `TStepId` _extends_ `string`                                     | `string`                                    |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\>                |
| `TStepMeta`                                                      | `unknown`                                   |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\>                |

## Properties

### meta?

```ts
optional meta?: TStepMeta;
```

Defined in: [packages/core/src/types/journey.types.ts:130](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L130)

---

### onEnter?

```ts
optional onEnter?: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;
```

Defined in: [packages/core/src/types/journey.types.ts:132](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L132)

Called when the machine enters this step.

---

### onLeave?

```ts
optional onLeave?: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;
```

Defined in: [packages/core/src/types/journey.types.ts:134](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L134)

Called when the machine leaves this step.
