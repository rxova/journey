[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / JourneyDevtoolsBridgeObservationEnvelope

# Type Alias: JourneyDevtoolsBridgeObservationEnvelope

```ts
type JourneyDevtoolsBridgeObservationEnvelope = JourneyDevtoolsEnvelopeBase & object;
```

Defined in: [devtools-bridge/src/protocol.ts:163](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L163)

## Type Declaration

### event

```ts
event: Record<string, unknown>;
```

### kind

```ts
kind: "observation";
```

### source

```ts
source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
```
