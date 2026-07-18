---
title: "Panel Guide"
---

## Machine selector

The panel lists every machine registered by the inspected page. Metadata shows mode, lifecycle
status, mutation policy, and advertised feature groups.

## Snapshot

The snapshot view displays the current protocol envelope. Linear and graph snapshots are
discriminated by `type`; graph routing fields and linear declared-order fields appear only on their
matching snapshot.

## Timeline

Rows record registration, snapshots, observations, operation results, and errors. Selecting a row
shows:

- **Action**: the envelope or invocation that produced the row.
- **State**: the serialized snapshot associated with that point.
- **Diff**: a structured comparison with the preceding retained state.

**Follow latest** pins selection to new rows. Display limits control rendering; pruning removes older
retained rows for the active machine. Selection and pruning are panel-local and do not mutate the
runtime machine.

## Operations

The panel groups forms from generic feature and operation descriptors sent by the bridge. Each
descriptor provides a stable operation ID, label, fields, result kind, and whether it mutates.
Lifecycle, navigation, context, graph-event, async, and plugin operations therefore appear only when
the attached machine advertises them.

When `mutationsEnabled` is false, mutating forms are disabled while read-only operations remain
available. Lifecycle forms are also disabled when their source status is invalid.

## Compatibility

Protocol v7 is current. v6 invoke envelopes remain compatible because their shape is identical. v5
is tolerated for registration but cannot invoke operations. The panel displays compatibility state
when a machine cannot use the full current surface.
