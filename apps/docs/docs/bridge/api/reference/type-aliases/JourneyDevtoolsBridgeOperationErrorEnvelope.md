[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / JourneyDevtoolsBridgeOperationErrorEnvelope

# Type Alias: JourneyDevtoolsBridgeOperationErrorEnvelope

```ts
type JourneyDevtoolsBridgeOperationErrorEnvelope = JourneyDevtoolsEnvelopeBase & object;
```

Defined in: [devtools-bridge/src/protocol.ts:177](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L177)

## Type Declaration

### error

```ts
error: JourneyDevtoolsSerializedError;
```

### kind

```ts
kind: "operationError";
```

### operationId

```ts
operationId: string;
```

### requestId

```ts
requestId: string;
```

### source

```ts
source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
```
