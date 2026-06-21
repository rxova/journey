[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / JourneyDevtoolsExtensionInvokeEnvelope

# Type Alias: JourneyDevtoolsExtensionInvokeEnvelope

```ts
type JourneyDevtoolsExtensionInvokeEnvelope = JourneyDevtoolsEnvelopeBase & object;
```

Defined in: [devtools-bridge/src/protocol.ts:185](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L185)

## Type Declaration

### invocation

```ts
invocation: JourneyDevtoolsOperationInvoke;
```

### kind

```ts
kind: "invoke";
```

### requestId

```ts
requestId: string;
```

### source

```ts
source: typeof JOURNEY_DEVTOOLS_EXTENSION_SOURCE;
```
