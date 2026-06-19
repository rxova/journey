[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyDisposedError

# Class: JourneyDisposedError

Defined in: [packages/core/src/journey-machine/helpers.ts:288](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-machine/helpers.ts#L288)

## Extends

- `Error`

## Constructors

### Constructor

```ts
new JourneyDisposedError(operation): JourneyDisposedError;
```

Defined in: [packages/core/src/journey-machine/helpers.ts:292](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-machine/helpers.ts#L292)

#### Parameters

| Parameter   | Type     |
| ----------- | -------- |
| `operation` | `string` |

#### Returns

`JourneyDisposedError`

#### Overrides

```ts
Error.constructor;
```

## Properties

| Property                                    | Modifier   | Type     | Default value            | Overrides    | Inherited from  | Defined in                                                                                                                                                                           |
| ------------------------------------------- | ---------- | -------- | ------------------------ | ------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-message"></a> `message`     | `public`   | `string` | `undefined`              | -            | `Error.message` | node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/lib.es5.d.ts:1075                                                                                                    |
| <a id="property-name"></a> `name`           | `public`   | `string` | `"JourneyDisposedError"` | `Error.name` | -               | [packages/core/src/journey-machine/helpers.ts:289](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-machine/helpers.ts#L289) |
| <a id="property-operation"></a> `operation` | `readonly` | `string` | `undefined`              | -            | -               | [packages/core/src/journey-machine/helpers.ts:290](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-machine/helpers.ts#L290) |
| <a id="property-stack"></a> `stack?`        | `public`   | `string` | `undefined`              | -            | `Error.stack`   | node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/lib.es5.d.ts:1076                                                                                                    |
