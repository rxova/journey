[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / JourneyDevtoolsOperationResultPayload

# Type Alias: JourneyDevtoolsOperationResultPayload

```ts
type JourneyDevtoolsOperationResultPayload =
  | {
      error?: JourneyDevtoolsSerializedError;
      kind: "snapshot";
      snapshot: JourneyDevtoolsSerializableSnapshot;
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

Defined in: [devtools-bridge/src/protocol.ts:116](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L116)
