[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / JourneyDevtoolsMachineOperationDescriptor

# Type Alias: JourneyDevtoolsMachineOperationDescriptor

```ts
type JourneyDevtoolsMachineOperationDescriptor = object;
```

Defined in: [devtools-bridge/src/protocol.ts:58](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L58)

Metadata describing one devtools-invokable operation (id, label, inputs, output kind).

## Properties

### description

```ts
description: string | null;
```

Defined in: [devtools-bridge/src/protocol.ts:61](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L61)

---

### fields

```ts
fields: readonly JourneyMachineDevtoolsFieldSpec[];
```

Defined in: [devtools-bridge/src/protocol.ts:64](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L64)

---

### id

```ts
id: string;
```

Defined in: [devtools-bridge/src/protocol.ts:59](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L59)

---

### label

```ts
label: string;
```

Defined in: [devtools-bridge/src/protocol.ts:60](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L60)

---

### mutates

```ts
mutates: boolean;
```

Defined in: [devtools-bridge/src/protocol.ts:62](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L62)

---

### output

```ts
output: JourneyMachineDevtoolsOperationResultKind;
```

Defined in: [devtools-bridge/src/protocol.ts:63](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/protocol.ts#L63)
