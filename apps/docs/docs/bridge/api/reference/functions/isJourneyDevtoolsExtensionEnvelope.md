[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / isJourneyDevtoolsExtensionEnvelope

# Function: isJourneyDevtoolsExtensionEnvelope()

```ts
function isJourneyDevtoolsExtensionEnvelope(value): value is JourneyDevtoolsExtensionInvokeEnvelope;
```

Defined in: [devtools-bridge/src/protocol.ts:456](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L456)

Returns true when a payload matches the extension-to-bridge devtools envelope shape.

## Parameters

| Parameter | Type      |
| --------- | --------- |
| `value`   | `unknown` |

## Returns

`value is JourneyDevtoolsExtensionInvokeEnvelope`
