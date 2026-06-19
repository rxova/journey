[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / createHeadlessJourney

# Function: createHeadlessJourney()

```ts
function createHeadlessJourney<TContext, TStepId, TStepMeta, THandlers, TPlugins>(
  definition,
  options?
): JourneyRuntime<TContext, TStepId, Record<never, never>, TStepMeta, TPlugins, THandlers>;
```

Defined in: [react/src/CreateHeadlessJourney.tsx:13](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/CreateHeadlessJourney.tsx#L13)

Creates a headless journey runtime for React. Navigation is entirely caller-driven via `machine.goToStepById`.

## Type Parameters

| Type Parameter                                                                                    | Default type                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ `JourneyJsonObject`                                                          | -                            |
| `TStepId` _extends_ `string`                                                                      | -                            |
| `TStepMeta`                                                                                       | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                             | `Record`\<`never`, `never`\> |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](../type-aliases/JourneyMachinePlugin.md)[] | \[\]                         |

## Parameters

| Parameter    | Type                                                                           |
| ------------ | ------------------------------------------------------------------------------ |
| `definition` | `HeadlessJourneyDefinition`\<`TContext`, `TStepId`, `TStepMeta`, `THandlers`\> |
| `options?`   | `JourneyOptionsInput`\<`TPlugins`\>                                            |

## Returns

[`JourneyRuntime`](../type-aliases/JourneyRuntime.md)\<`TContext`, `TStepId`, `Record`\<`never`, `never`\>, `TStepMeta`, `TPlugins`, `THandlers`\>
