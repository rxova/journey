[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyTimeoutError

# Class: JourneyTimeoutError

Defined in: [packages/core/src/journey-machine/helpers.ts:280](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-machine/helpers.ts#L280)

## Extends

- `Error`

## Constructors

### Constructor

```ts
new JourneyTimeoutError(message): JourneyTimeoutError;
```

Defined in: [packages/core/src/journey-machine/helpers.ts:283](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-machine/helpers.ts#L283)

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `message` | `string` |

#### Returns

`JourneyTimeoutError`

#### Overrides

```ts
Error.constructor;
```

## Properties

| Property                                | Type     | Default value           | Overrides    | Inherited from  | Defined in                                                                                                                                                                           |
| --------------------------------------- | -------- | ----------------------- | ------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-message"></a> `message` | `string` | `undefined`             | -            | `Error.message` | node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/lib.es5.d.ts:1075                                                                                                    |
| <a id="property-name"></a> `name`       | `string` | `"JourneyTimeoutError"` | `Error.name` | -               | [packages/core/src/journey-machine/helpers.ts:281](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-machine/helpers.ts#L281) |
| <a id="property-stack"></a> `stack?`    | `string` | `undefined`             | -            | `Error.stack`   | node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/lib.es5.d.ts:1076                                                                                                    |
