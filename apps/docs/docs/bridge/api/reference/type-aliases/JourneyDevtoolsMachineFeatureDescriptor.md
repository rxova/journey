[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / JourneyDevtoolsMachineFeatureDescriptor

# Type Alias: JourneyDevtoolsMachineFeatureDescriptor

```ts
type JourneyDevtoolsMachineFeatureDescriptor = object;
```

Defined in: [devtools-bridge/src/protocol.ts:68](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L68)

A named group of devtools operations (core navigation, plugin features, …).

## Properties

### description

```ts
description: string | null;
```

Defined in: [devtools-bridge/src/protocol.ts:71](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L71)

---

### id

```ts
id: string;
```

Defined in: [devtools-bridge/src/protocol.ts:69](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L69)

---

### label

```ts
label: string;
```

Defined in: [devtools-bridge/src/protocol.ts:70](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L70)

---

### operations

```ts
operations: readonly JourneyDevtoolsMachineOperationDescriptor[];
```

Defined in: [devtools-bridge/src/protocol.ts:72](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L72)
