[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyMachine

# Type Alias: JourneyMachine\<TContext, TStepId, TEventMap, TStepMeta, THandlers\>

```ts
type JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers> =
  JourneyTypeParam<THandlers> & {
    clearStepError: (stepId?) => Promise<JourneySnapshot<TContext, TStepId>>;
    completeJourney: (payload?) => Promise<JourneySendResult<TContext, TStepId>>;
    dispose: () => void;
    getComputed: () => JourneyComputed<TStepId>;
    getSnapshot: () => JourneySnapshot<TContext, TStepId>;
    getStepMeta: (stepId) => TStepMeta | undefined;
    goToLastVisitedStep: () => Promise<JourneySendResult<TContext, TStepId>>;
    goToNextStep: () => Promise<JourneySendResult<TContext, TStepId>>;
    goToPreviousStep: (steps?) => Promise<JourneySendResult<TContext, TStepId>>;
    goToStepById: (stepId) => Promise<JourneySendResult<TContext, TStepId>>;
    resetJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
    send: (event) => Promise<JourneySendResult<TContext, TStepId>>;
    startJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
    subscribe: (listener) => () => void;
    subscribeComplete: (listener) => () => void;
    subscribeEvent: (listener) => () => void;
    subscribeReset: (listener) => () => void;
    subscribeSelector: <TSelected>(selector, listener, equalityFn?) => () => void;
    subscribeStart: (listener) => () => void;
    subscribeTerminate: (listener) => () => void;
    terminateJourney: (payload?) => Promise<JourneySendResult<TContext, TStepId>>;
    updateContext: (updater) => Promise<JourneySnapshot<TContext, TStepId>>;
  };
```

Defined in: [packages/core/src/types/machine.types.ts:283](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L283)

Runtime machine API for reading snapshots, sending events, and controlling flow.

## Type Declaration

| Name                    | Type                                                                                              | Defined in                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clearStepError()`      | (`stepId?`) => `Promise`\<[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>\>      | [packages/core/src/types/machine.types.ts:310](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L310) |
| `completeJourney()`     | (`payload?`) => `Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\> | [packages/core/src/types/machine.types.ts:302](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L302) |
| `dispose()`             | () => `void`                                                                                      | [packages/core/src/types/machine.types.ts:312](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L312) |
| `getComputed()`         | () => [`JourneyComputed`](JourneyComputed.md)\<`TStepId`\>                                        | [packages/core/src/types/machine.types.ts:292](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L292) |
| `getSnapshot()`         | () => [`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>                            | [packages/core/src/types/machine.types.ts:290](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L290) |
| `getStepMeta()`         | (`stepId`) => `TStepMeta` \| `undefined`                                                          | [packages/core/src/types/machine.types.ts:291](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L291) |
| `goToLastVisitedStep()` | () => `Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>           | [packages/core/src/types/machine.types.ts:306](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L306) |
| `goToNextStep()`        | () => `Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>           | [packages/core/src/types/machine.types.ts:297](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L297) |
| `goToPreviousStep()`    | (`steps?`) => `Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>   | [packages/core/src/types/machine.types.ts:305](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L305) |
| `goToStepById()`        | (`stepId`) => `Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>   | [packages/core/src/types/machine.types.ts:298](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L298) |
| `resetJourney()`        | () => `Promise`\<[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>\>               | [packages/core/src/types/machine.types.ts:311](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L311) |
| `send()`                | (`event`) => `Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>    | [packages/core/src/types/machine.types.ts:294](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L294) |
| `startJourney()`        | () => `Promise`\<[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>\>               | [packages/core/src/types/machine.types.ts:293](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L293) |
| `subscribe()`           | (`listener`) => () => `void`                                                                      | [packages/core/src/types/machine.types.ts:313](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L313) |
| `subscribeComplete()`   | (`listener`) => () => `void`                                                                      | [packages/core/src/types/machine.types.ts:324](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L324) |
| `subscribeEvent()`      | (`listener`) => () => `void`                                                                      | [packages/core/src/types/machine.types.ts:319](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L319) |
| `subscribeReset()`      | (`listener`) => () => `void`                                                                      | [packages/core/src/types/machine.types.ts:323](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L323) |
| `subscribeSelector()`   | \<`TSelected`\>(`selector`, `listener`, `equalityFn?`) => () => `void`                            | [packages/core/src/types/machine.types.ts:314](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L314) |
| `subscribeStart()`      | (`listener`) => () => `void`                                                                      | [packages/core/src/types/machine.types.ts:322](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L322) |
| `subscribeTerminate()`  | (`listener`) => () => `void`                                                                      | [packages/core/src/types/machine.types.ts:327](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L327) |
| `terminateJourney()`    | (`payload?`) => `Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\> | [packages/core/src/types/machine.types.ts:299](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L299) |
| `updateContext()`       | (`updater`) => `Promise`\<[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>\>      | [packages/core/src/types/machine.types.ts:307](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L307) |

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
