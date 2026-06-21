[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / JourneyDevtoolsBridgeOperationResultEnvelope

# Type Alias: JourneyDevtoolsBridgeOperationResultEnvelope

```ts
type JourneyDevtoolsBridgeOperationResultEnvelope = JourneyDevtoolsEnvelopeBase & object;
```

Defined in: [devtools-bridge/src/protocol.ts:169](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L169)

## Type Declaration

### kind

```ts
kind: "operationResult";
```

### operationId

```ts
operationId: string;
```

### requestId

```ts
requestId: string;
```

### result

```ts
result: JourneyDevtoolsOperationResultPayload;
```

### source

```ts
source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
```
