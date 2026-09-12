---
title: "Connectors"
---

Connectors adapt another library to an existing Journey primitive. They do not attach to a machine,
observe lifecycle events, or add anything under `machine.plugins`. A connector instead returns a
value that an ordinary Core API already accepts.

This makes connectors different from plugins:

| Integration | Use it when                                                                       |
| ----------- | --------------------------------------------------------------------------------- |
| Connector   | Another library can improve how you author an existing Core value or callback.    |
| Plugin      | A concern needs to observe a running machine and expose namespaced state or APIs. |

Connectors live behind dedicated package entry points. Their third-party libraries are optional
peers, so installing and importing Core alone does not include those dependencies.

## Available connectors

- [Immer](./immer) adapts an Immer producer into a `ContextUpdater` for convenient immutable context
  changes.

## Context remains a Core concern

A connector changes authoring ergonomics, not Journey semantics. Context updates still publish at
the same time, transactional work still stages updates until navigation commits, and persistence or
DevTools consumers still require context values that their transports can serialize.
