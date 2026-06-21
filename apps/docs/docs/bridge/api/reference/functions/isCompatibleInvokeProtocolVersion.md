[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / isCompatibleInvokeProtocolVersion

# Function: isCompatibleInvokeProtocolVersion()

```ts
function isCompatibleInvokeProtocolVersion(value): value is 5 | 6;
```

Defined in: [devtools-bridge/src/protocol.ts:41](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L41)

Whether the bridge can process an `invoke` from a given protocol version.
Accepts the current and prior versions (their invoke shapes are identical);
the v3 legacy version is tolerated for register envelopes but cannot invoke.

## Parameters

| Parameter | Type      |
| --------- | --------- |
| `value`   | `unknown` |

## Returns

value is 5 \| 6
