[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / JourneyDevtoolsBridgeOptions

# Type Alias: JourneyDevtoolsBridgeOptions

```ts
type JourneyDevtoolsBridgeOptions = object;
```

Defined in: [devtools-bridge/src/bridge.ts:42](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/bridge.ts#L42)

Options for [attachJourneyDevtools](../functions/attachJourneyDevtools.md).

## Properties

### appName?

```ts
optional appName?: string;
```

Defined in: [devtools-bridge/src/bridge.ts:50](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/bridge.ts#L50)

App name shown in devtools. Defaults to `document.title`.

---

### ~~commandsEnabled?~~

```ts
optional commandsEnabled?: boolean;
```

Defined in: [devtools-bridge/src/bridge.ts:54](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/bridge.ts#L54)

#### Deprecated

Alias for [JourneyDevtoolsBridgeOptions.mutationsEnabled](#mutationsenabled).

---

### enabled?

```ts
optional enabled?: boolean;
```

Defined in: [devtools-bridge/src/bridge.ts:48](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/bridge.ts#L48)

Force the bridge on or off. Defaults to enabled only in non-production builds.

---

### label?

```ts
optional label?: string;
```

Defined in: [devtools-bridge/src/bridge.ts:46](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/bridge.ts#L46)

Human-readable label shown in the devtools panel.

---

### machineId?

```ts
optional machineId?: string;
```

Defined in: [devtools-bridge/src/bridge.ts:44](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/bridge.ts#L44)

Stable id for this machine in devtools. Defaults to a generated id.

---

### mutationsEnabled?

```ts
optional mutationsEnabled?: boolean;
```

Defined in: [devtools-bridge/src/bridge.ts:52](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/bridge.ts#L52)

Allow devtools to mutate the machine (navigate, patch context). Defaults to non-production.
