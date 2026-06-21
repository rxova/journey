[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / JourneyDevtoolsMachineMeta

# Type Alias: JourneyDevtoolsMachineMeta

```ts
type JourneyDevtoolsMachineMeta = object;
```

Defined in: [devtools-bridge/src/protocol.ts:90](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L90)

Static description of a machine sent in the `register` envelope: identity, mode, steps, events, and features.

## Properties

### appName

```ts
appName: string | null;
```

Defined in: [devtools-bridge/src/protocol.ts:93](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L93)

---

### eventTypes?

```ts
optional eventTypes?: readonly string[];
```

Defined in: [devtools-bridge/src/protocol.ts:97](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L97)

---

### eventTypesBySource?

```ts
optional eventTypesBySource?: Record<string, readonly string[]>;
```

Defined in: [devtools-bridge/src/protocol.ts:98](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L98)

---

### features

```ts
features: readonly JourneyDevtoolsMachineFeatureDescriptor[];
```

Defined in: [devtools-bridge/src/protocol.ts:101](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L101)

---

### goToStepTargetsBySource?

```ts
optional goToStepTargetsBySource?: Record<string, readonly string[]>;
```

Defined in: [devtools-bridge/src/protocol.ts:99](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L99)

---

### label

```ts
label: string;
```

Defined in: [devtools-bridge/src/protocol.ts:92](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L92)

---

### machineId

```ts
machineId: string;
```

Defined in: [devtools-bridge/src/protocol.ts:91](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L91)

---

### mode?

```ts
optional mode?: "linear" | "graph" | "headless";
```

Defined in: [devtools-bridge/src/protocol.ts:95](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L95)

---

### mutationsEnabled?

```ts
optional mutationsEnabled?: boolean;
```

Defined in: [devtools-bridge/src/protocol.ts:94](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L94)

---

### stepIds?

```ts
optional stepIds?: readonly string[];
```

Defined in: [devtools-bridge/src/protocol.ts:96](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L96)

---

### steps?

```ts
optional steps?: Record<string, JourneyDevtoolsStepFeatureDescriptor>;
```

Defined in: [devtools-bridge/src/protocol.ts:100](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L100)
