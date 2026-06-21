[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / JourneyDevtoolsBridgeSnapshotEnvelope

# Type Alias: JourneyDevtoolsBridgeSnapshotEnvelope

```ts
type JourneyDevtoolsBridgeSnapshotEnvelope = JourneyDevtoolsEnvelopeBase & object;
```

Defined in: [devtools-bridge/src/protocol.ts:157](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L157)

## Type Declaration

### kind

```ts
kind: "snapshot";
```

### snapshot

```ts
snapshot: JourneyDevtoolsSerializableSnapshot;
```

### source

```ts
source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
```
