[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION

# Variable: JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION

```ts
const JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION: 5;
```

Defined in: [devtools-bridge/src/protocol.ts:17](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L17)

Prior protocol version still accepted on the wire. v6 added per-step feature
metadata to the register envelope; the `invoke` envelope shape is unchanged
from v5, so a v6 bridge and a v5 extension interoperate.
