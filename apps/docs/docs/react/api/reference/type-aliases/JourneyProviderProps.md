[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneyProviderProps

# Type Alias: JourneyProviderProps\<TStepId\>

```ts
type JourneyProviderProps<TStepId> = object;
```

Defined in: [react/src/types.ts:74](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L74)

## Type Parameters

| Type Parameter               |
| ---------------------------- |
| `TStepId` _extends_ `string` |

## Properties

### children

```ts
children: React.ReactNode;
```

Defined in: [react/src/types.ts:78](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L78)

---

### disposeOnUnmount?

```ts
optional disposeOnUnmount?: boolean;
```

Defined in: [react/src/types.ts:77](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L77)

---

### onError?

```ts
optional onError?: (error, context) => void;
```

Defined in: [react/src/types.ts:76](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L76)

#### Parameters

| Parameter | Type                                                            |
| --------- | --------------------------------------------------------------- |
| `error`   | `unknown`                                                       |
| `context` | [`JourneyProviderErrorContext`](JourneyProviderErrorContext.md) |

#### Returns

`void`

---

### views

```ts
views: JourneyViews<TStepId>;
```

Defined in: [react/src/types.ts:75](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L75)
