[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyMachineDevtoolsOperationResult

# Type Alias: JourneyMachineDevtoolsOperationResult\<TContext, TStepId\>

```ts
type JourneyMachineDevtoolsOperationResult<TContext, TStepId> =
  | {
      error?: unknown;
      kind: "snapshot";
      snapshot: JourneySnapshot<TContext, TStepId>;
      transitioned?: boolean;
      transitionId?: string;
    }
  | {
      data: unknown;
      kind: "data";
    }
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "void";
    };
```

Defined in: [packages/core/src/types/machine.types.ts:84](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L84)

## Type Parameters

| Type Parameter                                                   |
| ---------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) |
| `TStepId` _extends_ `string`                                     |
