[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / JourneyDevtoolsStepFeatureDescriptor

# Type Alias: JourneyDevtoolsStepFeatureDescriptor

```ts
type JourneyDevtoolsStepFeatureDescriptor = object;
```

Defined in: [devtools-bridge/src/protocol.ts:80](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L80)

Per-step authored features, surfaced so devtools can show which steps carry
an effect, delayed (`after`) transitions, lifecycle callbacks, or metadata.
Added in protocol v6; absent on v5/v3 register envelopes.

## Properties

### afterDelays

```ts
afterDelays: readonly number[];
```

Defined in: [devtools-bridge/src/protocol.ts:83](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L83)

Delays (ms) of the step's `after` transitions, ascending. Empty when none.

---

### hasEffect

```ts
hasEffect: boolean;
```

Defined in: [devtools-bridge/src/protocol.ts:81](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L81)

---

### hasMeta

```ts
hasMeta: boolean;
```

Defined in: [devtools-bridge/src/protocol.ts:86](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L86)

---

### hasOnEnter

```ts
hasOnEnter: boolean;
```

Defined in: [devtools-bridge/src/protocol.ts:84](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L84)

---

### hasOnLeave

```ts
hasOnLeave: boolean;
```

Defined in: [devtools-bridge/src/protocol.ts:85](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L85)
