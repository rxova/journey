---
id: faq
title: FAQ
---

import DocAccordion, { DocAccordionItem } from "@site/src/components/DocAccordion";

# FAQ

<DocAccordion>

<DocAccordionItem title="Which factory should I use?">

Use `createLinearJourney` when declared order is the default forward path. Use
`createGraphJourney` when named events or guards choose the destination. V1 does not expose a third
headless factory; direct caller-driven jumps are available on linear machines.

</DocAccordionItem>

<DocAccordionItem title="Why is the machine API grouped?">

`controls`, `navigate`, `subscriptions`, and `context` make ownership clear and keep the stable base
surface small. Plugins use their own names under `machine.plugins` instead of merging methods into
that surface.

</DocAccordionItem>

<DocAccordionItem title="Does reaching the last step complete the journey?">

No. Completion is a product decision, so call `machine.controls.complete(payload?)` explicitly.
The last linear step and a graph terminal step can remain running.

</DocAccordionItem>

<DocAccordionItem title="How does back work?">

`machine.navigate.goToPreviousStep(n?)` moves the realized timeline pointer. It does not search the
definition or send a graph event. Pass navigation work when saving or validation must succeed before
moving; source `onLeave` is a post-commit side effect.

</DocAccordionItem>

<DocAccordionItem title="Can a linear journey jump to another step?">

Yes. `machine.navigate.goToStepById(id)` — or its declared-order sibling
`machine.navigate.goToStepByIndex(index)` — is an ungated escape hatch that can reach any declared
linear step. It is appropriate for occasional exceptional jumps. When named jumps, guards, or
branches become routine domain behavior, convert the definition to graph mode so movement policy is
explicit.

</DocAccordionItem>

<DocAccordionItem title="What happens when I branch after going back?">

The runtime removes timeline entries after the pointer and appends the new destination. The visited
map still records every step entered during the run.

</DocAccordionItem>

<DocAccordionItem title="Can guards be async?">

Graph `when` guards are synchronous and pure because they are evaluated while deriving available
events and targets. Pass async work to `goToNextStep` or `goToPreviousStep` when caller-driven
movement needs asynchronous approval.

</DocAccordionItem>

<DocAccordionItem title="How do I chain an event from a hook?">

Call `raise(event)` inside a graph hook. It queues the event until the current transition fully
settles. Calling `send()` directly while a hook chain is pending returns `transitioning`.

</DocAccordionItem>

<DocAccordionItem title="Can users resume from persistence automatically?">

Yes, through the `persist: { key, storage? }` creation option. A valid non-terminal record found at
creation seeds context, timeline, and position, and the first `start()` resumes at the persisted
step. An explicit `startAt` wins over the record, `restart()` always begins fresh, and invalid or
drifted records are ignored. Registering `createPersistencePlugin` explicitly stays save-only —
plugins are observe-only and cannot seed the runtime. See
[Persistence](./persistence#restore).

</DocAccordionItem>

<DocAccordionItem title="Do plugins change navigation?">

No. V1 plugins observe a read-only host and add namespaced APIs or snapshot extensions. Domain
movement belongs in the definition.

</DocAccordionItem>

<DocAccordionItem title="Do I need React?">

No. `@rxova/journey-core` has no UI or framework dependency. React bindings are a separate package.

</DocAccordionItem>

<DocAccordionItem title="When is Journey too much?">

For a few fixed screens where an index and next/back buttons are the entire requirement, local state
or a small wizard hook is simpler. Journey becomes useful when branching, async gates, realized
history, lifecycle outcomes, observation, or plugins are product requirements.

</DocAccordionItem>

</DocAccordion>
