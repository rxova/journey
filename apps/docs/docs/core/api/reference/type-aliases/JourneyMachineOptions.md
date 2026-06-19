[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyMachineOptions

# Type Alias: JourneyMachineOptions\<TPlugins\>

```ts
type JourneyMachineOptions<TPlugins> = {
  defaultTimeoutMs?: number;
  onLifecycleError?: (error, context) => void;
  onListenerError?: (error, context) => void;
  plugins?: TPlugins;
  requireExplicitCompletion?: boolean;
};
```

Defined in: [packages/core/src/types/machine.types.ts:257](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L257)

Optional machine features and plugin registration.

## Type Parameters

| Type Parameter                                                                    | Default type                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[] | readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[] |

## Properties

### defaultTimeoutMs?

```ts
optional defaultTimeoutMs?: number;
```

Defined in: [packages/core/src/types/machine.types.ts:261](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L261)

---

### onLifecycleError?

```ts
optional onLifecycleError?: (error, context) => void;
```

Defined in: [packages/core/src/types/machine.types.ts:274](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L274)

#### Parameters

| Parameter | Type                                                                          |
| --------- | ----------------------------------------------------------------------------- |
| `error`   | `unknown`                                                                     |
| `context` | [`JourneyLifecycleErrorContext`](JourneyLifecycleErrorContext.md)\<`string`\> |

#### Returns

`void`

---

### onListenerError?

```ts
optional onListenerError?: (error, context) => void;
```

Defined in: [packages/core/src/types/machine.types.ts:273](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L273)

Called when a snapshot or event listener throws an unhandled error.
Listener failures are isolated so they never block other listeners or
the machine itself — use this hook to report them to your error
monitoring system (e.g. Sentry, Datadog).

#### Parameters

| Parameter | Type                      | Description                                                                           |
| --------- | ------------------------- | ------------------------------------------------------------------------------------- |
| `error`   | `unknown`                 | The thrown value (may not be an `Error` instance).                                    |
| `context` | `"snapshot"` \| `"event"` | `"snapshot"` for `subscribe()` listeners, `"event"` for `subscribeEvent()` listeners. |

#### Returns

`void`

---

### plugins?

```ts
optional plugins?: TPlugins;
```

Defined in: [packages/core/src/types/machine.types.ts:262](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L262)

---

### requireExplicitCompletion?

```ts
optional requireExplicitCompletion?: boolean;
```

Defined in: [packages/core/src/types/machine.types.ts:260](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L260)
