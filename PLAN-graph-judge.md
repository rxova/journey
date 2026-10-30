# Plan: a Journey-graph judge for jev-planner that needs no TypeSafe

## Context

`Planner` (`orchestrator.ts`) makes every routing decision from a `JevVerdict` (`types.ts:170`). That verdict comes from `TypeSafeJevJudge` (`jev.ts`) through `@typesafe-ai/sdk`. A team without TypeSafe is stopped before any agent runs:

- `cli.ts:621` requires `TYPESAFE_API_KEY`;
- `doctor.ts:51` always checks for that key;
- `bin.ts:29` always constructs `TypeSafeJevJudge`.

The work comes in two phases:

- **Journey core first:** four additive changes that let a graph run itself headless (section 2). Each ships on its own and is useful to UI flows as well.
- **Phase A (required):** `@rxova/journey-judge`, a judge built on `@rxova/journey-core`. It is a graph: deterministic rules settle what they can, and an LLM panel answers only the rest. jev-planner uses it through a new `GraphJevJudge`. `Planner` does not change.
- **Phase B (optional):** a Journey graph that drives the whole pipeline, checked for parity with `Planner`. It runs the same way the judge does: `start()`, then `await machine.settled()`.

## Decisions

- **The SDK stays in `dependencies` during Phase A.** `index.ts:3` re-exports `TypeSafeJevJudge`, and `jev.ts:1` imports the SDK at load time. Making the SDK an optional peer would therefore break imports from the package root. The only thing blocking a team is the API key. The optional peer and a `./typesafe` subpath can come later, as a breaking release.
- **A judge that can't answer abstains per question, using that question's declared fallback.** The judge rejects only when every judge model is unreachable, which is how a Jev outage behaves today (`orchestrator.test.ts:1120`).
- **The driver retries only judge steps.** It never retries agent rounds, because they are billed, and never retries a rejected `onRound`, because the `onRound` contract says a rejection stops the run (`types.ts:280-284`).
- **`--jev-model` applies only to TypeSafe.** The graph judge's panel is configured under the `judge` key. When the graph judge is active, `--jev-model` triggers a warning.
- **The judge depends on `@rxova/journey-core`, as a peer,** like `journey-react` and `devtools-bridge`. core's `immer` peer is optional, so neither the judge nor jev-planner needs it. jev-planner lists the judge and core in `dependencies`. The graph does work a loop cannot show: which rule or which samples decided each answer is in the timeline, and `analyzeStructure` checks the judge's routing in a test.
- **Rules before models.** A question a rule settles is never sent to the panel. A question whose answer cannot change routing at this point of the run is not asked. It takes its fallback, marked `skipped`.
- **Journey changes to fit the need, instead of drivers working around it.** No external `ADVANCE` loop and no retry callback: the judge is a plain definition. Each core change must also make sense for a UI flow; one that only serves the judge does not go into core.
- **Kept as they are:** guards see only context (the v2 decision that keeps `availableEvents` true to what a send does), no parallel regions (fan-out stays inside one `run`), and step hooks get no `handlers` (`always` work has them).

## 1. What Journey has, and what is missing

**What already fits:**

- **Event work:** `run` (async), then `commit` (synchronous, stages context), then pure guards. If no candidate is enabled, the move rolls back (`runtime.ts:338-404`).
- **Candidates and typed work:** first-enabled candidates (`graph.types.ts:82`) and `defineWork` (`work.ts:99`).
- **Swappable dependencies:** `handlers`, overridable when a machine is created.
- **Per-work settings:** `timeoutMs` and `label`.
- **Typed completion:** `controls.complete(payload)`.
- **Plugins and checks:**
  - persistence (context, timeline and status, through a synchronous `getItem`);
  - replay and execution-paths;
  - `analyzeStructure`.

**What is missing:**

1. **No cancellation.** `SendWorkArgs` has no `AbortSignal`, and `withTimeout` (`runtime.ts:610`) rejects without cancelling the call.
2. **No retries.**
3. **No parallel regions.** Fan-out stays inside one `run`, where `round` and `firstAccepted` already handle quorum, grace and aborts.
4. **Guards see only context** (`work.ts:38`), so every verdict must be staged by `commit`.
5. **No awaitable headless run.**
   - Raised events are handled fire-and-forget (`runtime.ts:857`), and their `send` results are dropped (`runtime.ts:890`).
   - A failing `onEnter` doesn't stop the chain (`runtime.ts:823-857`).
   - Step hooks get no `handlers` (`graph.types.ts:231-233`).
   - So today a headless graph needs an external driver. Section 2 removes that need.

**Found on the way:** `work.ts:40` says routing on the work result was removed in v2, but the example at `work.ts:75` still writes `when: ({ result }) => …`, and `isEnabled` (`runtime.ts:508`) still passes `result` to guards although `TransitionGuard` no longer declares it. Remove both, as a `fix(core)` of its own, before the changes below.

## 2. Journey core changes

All four are additive, each is its own changeset with its own tests, and together they must keep `core/createGraphJourney` within its 6.5 kB size-limit.

**2.1 `signal` on work.** Add `readonly signal: AbortSignal` to `SendWorkArgs` and `NavigationWorkArgs`, and to `always` work.

- Create one controller per call, in `sendWithWork` and `runNavigation` (`runtime.ts:659`).
- Abort it on timeout, and on any generation change: terminate, restart, dispose.
- `withTimeout` then cancels instead of only rejecting.
- For UI flows: a fetch is cancelled when the user leaves the step.

**2.2 `always` work: steps that advance themselves.** A step may declare `always`, a work config (`run`, `commit`, `candidates`, `label`, `timeoutMs`, `retry`) or a plain candidate list.

- It runs after the step's entry effects settle, with the same staging and rollback as `sendWithWork`, and routes through its candidates. It is recorded as a transition with `event: null`.
- No enabled candidate: the machine stays on the step, as a send with no enabled candidate does.
- A chain of `always` moves without an outside send is bounded by `maxAutoSteps` (default 100, a runtime option). Past it, the machine applies the error policy (2.3). A cycle through `always` steps must be bounded by a guard over context, such as a counter.
- `availableEvents` does not list it; `analyzeStructure` treats it as an edge, so reachability, `terminalPathExists` and shadowed-candidate checks cover it.
- Persistence restores onto the step and re-runs its `always` work.
- For UI flows: redirect, loading and decision steps with no screen.

**2.3 `settled()` and an error policy.**

- `machine.settled(): Promise<JourneyOutcome>` resolves when the status becomes `completed` or `terminated`, at once if it already is.
- Runtime option `onError: 'stay' | 'terminate'`, default `'stay'`, which is today's behaviour. With `'terminate'`, a failing work, `always` work, `onEnter` or raised-event cascade terminates the machine with `{ error, phase, stepId }` as the payload.
- `settled()` rejects on `dispose()` with a `JourneyError('disposed')`.
- For UI flows: tests and server-side flows await an outcome instead of polling snapshots.

**2.4 `retry` on work.** `retry?: { attempts: number; delayMs?: number | ((attempt: number) => number); when?: (error: unknown) => boolean }`.

- Applies to `run` only; `commit` stays synchronous and is never retried.
- Each attempt gets a fresh `signal` and its own `timeoutMs`. The delay aborts with the generation.
- The snapshot stays `working` across attempts; `attempt` is added to the `error` event's details.
- Declared per work, so which steps may retry is part of the definition and visible to `analyzeStructure`.
- For UI flows: retrying a flaky network call without hand-written loops.

## 3. `@rxova/journey-judge`: a judgement is a graph run

Peer dependency: `@rxova/journey-core`, at the version that ships section 2. It has no provider SDKs; callers supply `complete`.

The judge is a plain graph definition. Every step is an `always` step (2.2), so nothing outside sends events. `ask()` is:

```ts
const machine = createGraphJourney(judgeDefinition, { handlers: { panel, ... }, onError: "terminate", maxAutoSteps });
machine.start();
signal?.addEventListener("abort", () => machine.terminate({ aborted: true }), { once: true });
const outcome = await machine.settled();
```

Its context is `{ state, questions, settled, samples, calls, answers, short }`.

| Step        | `always` `run`                                                                                                                                                                                  | `commit` stages                                                                                                                       | Candidates, in order                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `rules`     | Each question's rules, over `state`. Pure and synchronous.                                                                                                                                      | `settled`: each settled answer, with confidence 1 and `source: 'rule'`; skipped questions with their fallback and `source: 'skipped'` | `sample`[some question open] · `done`                           |
| `sample`    | One round of samples for the open questions, across the panel, with plan-order rotation, `concurrency` and the work's `signal` (2.1). `retry` (2.4) covers a model call that fails transiently. | the raw samples; `calls`                                                                                                              | `repair`[invalid ∧ repairs left ∧ calls<maxCalls] · `aggregate` |
| `repair`    | One repair prompt per invalid sample, with the validation errors                                                                                                                                | the repaired samples; `calls`                                                                                                         | `aggregate`                                                     |
| `aggregate` | Pure: mean, median or plurality for each open question                                                                                                                                          | `answers` with `source: 'panel'`; `short`: the questions below quorum                                                                 | `sample`[short ∧ calls<maxCalls] · `abstain`[short] · `done`    |
| `abstain`   | —                                                                                                                                                                                               | each short question's fallback, with `abstained: true`                                                                                | `done`                                                          |
| `done`      | `complete({ answers, calls, trail })`                                                                                                                                                           | —                                                                                                                                     | —                                                               |

- The `aggregate` → `sample` cycle is bounded by the `calls<maxCalls` guard; `maxAutoSteps` is the backstop.
- **Unreachable.** When every panel model fails in one `sample` run after its retries, the work rejects and `onError: 'terminate'` ends the machine. `ask` maps the outcome: an error payload → `JudgeError('unreachable')`, an abort → `JudgeError('aborted')`.
- **The trail.** The machine's timeline becomes `trail`: the path taken, and for each answer its `source` (`rule`, `panel`, `abstained` or `skipped`), the rule id or the sample ids, and `calls`. jev-planner writes it to the round directory as `judge.json`.
- **Rules.** `type Rule<Q> = { id: string; decide(state): Answer<Q> | undefined }`. A rule that returns `undefined` leaves the question to the next rule, and then to the panel. The first rule that answers wins.

Unchanged from before, inside `sample` and `aggregate`:

- **Schema.**
  - The package emits a JSON Schema for the provider's structured-output or tool modes.
  - It validates replies with a built-in validator or any Standard Schema (`~standard`) one.
  - Option keys are opaque (`plan_A`, …) and are mapped back after sampling.
- **Variety between samples.**
  - Temperature defaults to 0.7 where the model supports it.
  - Plan order rotates deterministically, and labels are reassigned per rotation.
  - By default N is the smallest multiple of the plan count that is at least 3, so every plan sits in every position equally often.
- **Combining samples.**
  - **binary:** each sample answers on a 5-point scale mapped to 0, .25, .5, .75 and 1; take the mean.
  - **choice:** weighted plurality, with confidence equal to the vote share. The answer is `tie` when the leader's share is below 0.5 or the top two are level.
  - **score:** the median on the 0–3 scale, with confidence 1 − IQR/3.
- **Bias and injection.**
  - Warn when a judge model also wrote a plan.
  - Treat plans as untrusted input: fence them in the prompt and keep `MAX_PLAN_CHARS`.

```ts
export type Question =
  | { kind: "choice"; ask: string; options: Record<string, string>; fallback: string }
  | { kind: "score"; ask: string; levels: readonly string[] }
  | { kind: "binary"; ask: string; yes: string; no: string; fallback: number };
export type Source = "rule" | "panel" | "abstained" | "skipped";
export type Answer<Q> = (Q extends { kind: "choice"; options: infer O }
  ? {
      choice: Extract<keyof O, string> | "tie";
      votes: Partial<Record<Extract<keyof O, string>, number>>;
    }
  : Q extends { kind: "score" }
    ? { score: number }
    : { probability: number }) & { confidence: number; abstained: boolean; source: Source };
export type Rule<Q, S> = {
  readonly id: string;
  decide(state: S): Omit<Answer<Q>, "source" | "abstained"> | undefined;
};
export type JudgeModel = {
  readonly id: string;
  weight?: number;
  complete(r: {
    system: string;
    prompt: string;
    schema: object;
    temperature?: number;
    signal?: AbortSignal;
  }): Promise<string>;
};
export class JudgeError extends Error {
  readonly code: "unreachable" | "aborted";
}
export function createJudge(o: {
  panel: readonly JudgeModel[];
  samples?: number;
  temperature?: number;
  repairAttempts?: number;
  quorum?: number;
  maxCalls?: number;
  concurrency?: number;
  timeoutMs?: number;
}): {
  ask<S extends Record<string, unknown>, const Qs extends Record<string, Question>>(i: {
    state: S;
    questions: Qs;
    signal?: AbortSignal;
    rules?: { [K in keyof Qs]?: readonly Rule<Qs[K], S>[] };
    skip?: readonly (keyof Qs)[];
  }): Promise<{ answers: { [K in keyof Qs]: Answer<Qs[K]> }; calls: number; trail: JudgeTrail }>;
  /** The judge's graph definition, for `analyzeStructure` and devtools. */
  readonly definition: GraphJourneyDefinition;
};
```

## 4. Phase A, file by file (jev-planner)

| File                                                            | Change                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/jev-questions.ts` (new)                                    | Rebuild `STAGE_TEXT`, stands-alone, `dispute_<n>` questions, agent options and `bounded` on the neutral `Question` type.                                                                                                                                                      |
| `src/jev.ts`                                                    | `TypeSafeJevJudge` translates the neutral questions into SDK `choice`/`score`/`noul`. `jev.test.ts` must stay green unchanged.                                                                                                                                                |
| `src/jev-rules.ts` (new)                                        | jev-planner's rules and skips (below). Pure functions over the judge state, each with its own tests.                                                                                                                                                                          |
| `src/graph-jev.ts` (new)                                        | `GraphJevJudge implements JevJudge`. It builds the state, rules and skips for the stage and calls `ask`. Map answers field by field, as `jev.ts:172-196` does. `model` = the panel ids, with `rule:<keys>` and `abstained:<keys>` suffixes. Writes the trail to `judge.json`. |
| `src/judge-models.ts` (new)                                     | `JudgeModel` adapters over `PROVIDERS` (`providers.ts:159`). OpenAI-compatible providers (deepseek, kimi, glm) use `response_format` with a JSON schema. The CLI providers (claude, codex) get a JSON-only prompt, rely on validation and repair, and support no temperature. |
| `src/config.ts`, `config.schema.json` + `apps/docs/public` copy | `judge: { kind: 'typesafe' } \| { kind: 'graph', panel: [{ provider, model?, weight? }], samples?, maxCalls?, timeoutMs?, rules?: { claimChecks?: boolean } }`. The default is `typesafe`.                                                                                    |
| `package.json`                                                  | Add `@rxova/journey-judge` and `@rxova/journey-core` to `dependencies`. core's `engines` (>=20.11) sits below jev-planner's (>=20.19). `pack-smoke` must install and import the tarball with them.                                                                            |
| `src/cli.ts`                                                    | Run the key check at `:621` only when the judge is `typesafe`. Warn about `--jev-model` when the judge is `graph`. Pass the judge settings to `createPlanner`.                                                                                                                |
| `src/bin.ts`                                                    | Build the judge from its settings. Load `jev.js` through dynamic `import()`. `omitEnv` already hides every provider's secrets from subprocesses.                                                                                                                              |
| `src/doctor.ts`                                                 | Check what the selected judge needs: the TypeSafe key, or each panel provider's login or key.                                                                                                                                                                                 |
| `src/index.ts`                                                  | Also export `GraphJevJudge`. This is additive.                                                                                                                                                                                                                                |

**Fallbacks:**

| Question             | Fallback                                                 | Reason                                                                              |
| -------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `needs_another_pass` | 0                                                        | A judge that has failed never buys another billed round.                            |
| `stands_alone`       | 0                                                        | The run synthesizes and never adopts on a failed verdict.                           |
| `stronger_plan`      | `tie`                                                    | `selectStronger` finds no plan (`orchestrator.ts:552-555`), so the run synthesizes. |
| `finalizer`          | the plurality among valid samples, else `plans[0].agent` | Always a real agent, so `orchestrator.ts:584` can't throw.                          |
| disputes             | `unclear`                                                | Matches `jev.ts:191`.                                                               |

**Rules and skips** (`jev-rules.ts`):

| Rule                      | Settles                      | When                                                                                                                               | On by default                                                                    |
| ------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `one-plan`                | `stronger_plan`, `finalizer` | Only one plan survived: it is both, with no model call                                                                             | yes                                                                              |
| `too-short`               | `stands_alone` = 0           | A plan is empty or below the veto length                                                                                           | yes                                                                              |
| `checks-agree`            | `dispute_<n>`                | At least two checkers read the repository and all returned the same `confirm` or `refute` (`types.ts:61`); `unknown` never settles | no, `judge.rules.claimChecks` turns it on until calibration shows it matches Jev |
| skip `needs_another_pass` | fallback 0, `skipped`        | `reviewRounds` already equals the maximum, so `Planner` cannot act on it                                                           | yes                                                                              |
| skip `stronger_plan`      | fallback `tie`, `skipped`    | The draft stage, where `selectStronger` does not apply                                                                             | yes                                                                              |

The skips need the round counters, so `JevInput` gains an optional `progress: { reviewRounds, maxReviewRounds }`. `TypeSafeJevJudge` ignores it. This is additive.

**The `solo` stage** (fast mode) skips `stronger_plan` and `finalizer`, and sets both to the only agent. `Planner` ignores both fields for a solo draft (`types.ts:208-210`).

## 5. Phase B: `JourneyPlanner` (behind `--engine journey`)

**Refactor first:**

- Extract `round`, `firstAccepted` and `strongest` (`orchestrator.ts:632,738,849`) into module-level functions.
- Lift the closures in `plan()` (`generate`, `revise`, `judge`, `report`, `debate`) into a `Run` object that owns `cost`, `timings` and the session map.
- Validation (`orchestrator.ts:116-134`) runs before the machine starts.

**The graph:**

| Step                   | `run`                                                                           | `onRound` stage                                                                 | Candidates, in order                                                                       |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `start`                | Draft round. In fast mode, `firstAccepted` plus a solo judgement for each draft | `draft`: with its verdict when fast mode accepted a draft, without one in ultra | `adopt`[accepted] · `critique`[ultra∧debate∧max≥1] · `revise`[ultra∧max≥1] · `judgeDrafts` |
| `judgeDrafts`          | `judge('draft')`                                                                | `draft` + verdict                                                               | `critique`[debate∧wantsPass] · `revise`[wantsPass] · `synthesize`                          |
| `critique`             | Critique round + `parseCritique`                                                | `critique`                                                                      | `reply`                                                                                    |
| `reply`                | Replies + `parseReply`, `buildDisputes`, `assignChecks`                         | `reply`, only if checks will run                                                | `check`[claimChecks∧≥2 readers∧assigned] · `judgeReview`                                   |
| `check`                | Checks + `parseChecks`                                                          | —                                                                               | `judgeReview`                                                                              |
| `revise`               | Revise round, targeted with `disputeFeedback` after a debate                    | —                                                                               | `judgeReview`                                                                              |
| `judgeReview`          | `judge('review', disputes)`, then `reviewRounds += 1`                           | `check` if checks ran, else `review`                                            | `revise`[wantsPass] · `adopt`[decision.adopt] · `synthesize`                               |
| `adopt` / `synthesize` | Take the plan whole, or merge with `finalizerOverride ?? verdict.finalizer`     | `final` (`selected` when adopted)                                               | `done` → `complete(PlanResult)`                                                            |

**Routing:**

- Context holds `thresholds`, which default to `orchestrator.ts:61-71` and can be overridden through `PlanOptions`.
- `commit` stages a `decision` object:
  - `needsPass`;
  - `adopt: AgentName | null`, which mirrors `accepted ?? selected ?? (standsAlone ? strongest : undefined)`.
- Guards read only `decision` and the counters. `wantsPass = mode≠fast ∧ reviewRounds<max ∧ needsPass`. The pass check comes before adopt, as in `orchestrator.ts:507` → `:556`.
- The judge gets its own steps, so a retried or resumed judge failure doesn't pay for an agent round again.

**Reporting.** Each `run` ends with `await handlers.report(round)`. The `onStage` messages are kept verbatim.

**No driver.** Every step is an `always` step, and the machine runs with `onError: 'terminate'`. `JourneyPlanner.plan()` starts it and awaits `settled()`.

- The judge steps declare `retry`; agent-round steps declare none, because they are billed. A rejected `onRound` is never retried: it fails the step and terminates the run.
- An abort terminates the machine.
- It awaits `send('ADVANCE')` until the machine reaches `completed`.
- A failed judge step is retried up to `judgeRetries`. Any other failure calls `terminate({ error })` and rejects.
- An abort terminates the run.
- Exceeding `maxSteps` rejects.

**Sessions** stay in the handlers, because providers change `AgentSession` in place (`types.ts:120`). `commit` copies each `id` into context, and a resumed run rebuilds the sessions from those ids.

**Persistence** uses a file-backed `JourneyStorage` with a synchronous `getItem`, keyed by the run directory.

**Example:** `examples/core-planner-pipeline`, a Node script with fake agents and a fake judge.

## 6. Edge cases

- **Fewer than two plans.** `round` waits rather than drop below `MIN_PLANS`. If only one plan survives, it is the stronger plan and its author is the finalizer, with no model call.
- **Fast mode with no draft accepted:** `judgeDrafts`, then `synthesize`; it never reviews.
- **Ultra with `maxReviewRounds` 0:** `judgeDrafts`, then `synthesize`.
- **`selectStronger`:**
  - it applies only after a review;
  - a `tie` means the run synthesizes.
- **Debate:**
  - disputes past the cap (`overflow`) are reported but not ruled on;
  - claim checks are skipped, with a stage message, when fewer than two agents read the repository;
  - a dispute with no ruling is `unclear`;
  - accepted objections never reach the judge.
- **Vetoes:** an empty or too-short plan can't stand alone.
- **Resume:**
  - the step that was in flight re-runs and is billed again;
  - an expired session falls back to the full `prompt`.

## 7. Build order (each step is done when its tests pass)

1. **`fix(core)`: remove the leftover `result` in guards** (`work.ts:75`, `runtime.ts:508`). Test: a guard receives only `context` and `handlers`.
2. **Core 2.1, `signal`.** Tests: it aborts on timeout, terminate, restart and dispose, next to `per-edge-timeout.test.ts` and `runtime-races.test.ts`.
3. **Core 2.2, `always`.** Tests:
   - a chain of `always` steps reaches `complete` after one `start()`;
   - no enabled candidate stays on the step; a rollback discards the staged context;
   - `maxAutoSteps` stops a cycle; a generation change mid-chain stops it;
   - `analyzeStructure` sees `always` edges; persistence re-runs the step's work on restore;
   - React: `useJourney` renders each step of a chain without tearing.
4. **Core 2.3, `settled()` and `onError`.** Tests: resolves on complete and terminate, at once when already settled, rejects on dispose; `'terminate'` for each failure phase; `'stay'` unchanged.
5. **Core 2.4, `retry`.** Tests: attempts and delay, `when` filters, a fresh signal per attempt, a generation change cancels the delay, `commit` runs once.
   - After 2–5: size-limit still passes, and the docs and `llms.txt` cover each addition.
6. **`createJudge`.** Tests:
   - `analyzeStructure` on `definition`: `terminalPathExists`, the only cycle is `aggregate` → `sample`, no shadowed transitions;
   - a table of context → path: all settled goes `rules` → `done`; all abstain; repair then pass;
   - `maxCalls` bounds the `sample` cycle, and `maxAutoSteps` is the backstop;
   - the 5-point, median and plurality arithmetic;
   - rotation coverage and mapping back;
   - the `tie` rules;
   - repair, resampling, and `maxCalls` leading to abstention;
   - every model down → `unreachable`;
   - the signal reaching the model call;
   - the trail names the source of every answer;
   - `*.type.ts` inference tests.
7. **`jev-questions.ts`, with `TypeSafeJevJudge` rewired onto it.** Test: `jev.test.ts` unchanged.
8. **`jev-rules.ts`, `GraphJevJudge`, the judge models, and the changes to config, CLI, bin and doctor.** Tests:
   - each rule and skip, and that a settled question makes no model call;
   - mapping tests;
   - an abstaining finalizer is still an agent;
   - solo asks the reduced set of questions;
   - `cli.test.ts` runs without `TYPESAFE_API_KEY`;
   - `doctor.test.ts` follows the selected judge;
   - `config.test.ts` covers the new key and the schema copies;
   - `orchestrator.test.ts` passes unchanged.
9. **Calibration.** Replay the logged rounds, which carry both the plans and Jev's verdicts, through the panel. Measure agreement on needs-pass, stands-alone, stronger plan and the dispute rulings, then fit the default thresholds. Measure `checks-agree` against Jev's dispute rulings before turning it on by default.
10. **The example.** Tests:

- `analyzeStructure` shows only the review cycle, `terminalPathExists`, and no shadowed transitions;
- a table of `decision` → path;
- the judge step retries, a rejected `report` terminates the run, and an abort terminates it.

11. **Phase B.** Tests:

- `describe.each([Planner, JourneyPlanner])` over `orchestrator.test.ts` and `single-provider.test.ts`, expecting the same `PlanResult` (without timings), the same `cost` including `jevCalls`, and the same `onRound` stages;
- resume from each step.

## 8. Rollout and compatibility

- **jev-planner:**
  - the default judge stays `typesafe`, so existing configs behave as before;
  - `CliDeps.createPlanner` gains the judge settings, an additive change;
  - release it as a minor version with a changeset.
- **Journey:**
  - the core fix and the four core changes each get a `minor`/`patch` changeset and ship first, in one core rc;
  - `@rxova/journey-judge` ships as an rc and must pass knip, sherif, size-limit and commitlint scopes.
- **A released jev-planner depends on an rc of core** until Journey 1.0. Pin the exact rc.
- **Cross-repo:** use a workspace link until the package is published.

## 9. Risks

- **Cost.** N × panel calls, plus resampling, replace the single call per judgement (`orchestrator.ts:500`). `maxCalls` bounds it.
- **Miscalibrated thresholds.** CLI judges show little variety between samples.
- **Abstentions could hide a broken judge.** They are visible through the `model` marker and `doctor`.
- **Self-preference and prompt injection.**
- **Scope.** Journey targets UI flows, so provider SDKs stay out of core and out of the judge package.
- **A rule that is wrong is wrong every time.** Unlike a sampled answer, it has no variance to show it. Each rule is reported in `model` and the trail, and `checks-agree` stays off until calibration.
- **Core's API is still rc.** A breaking change in core breaks the judge; the peer range pins it.
- **`always` loops.** A wrong guard can spin through `always` steps and spend billed calls. `maxAutoSteps` and the judge's `maxCalls` guard bound it, and `analyzeStructure` reports unbounded cycles.
- **Core grows.** Four features against a 6.5 kB budget. If they do not fit, `retry` is the first to move out, into a helper that wraps `run`.

## Open questions

1. Which further rules are worth adding after calibration, for example on objections accepted versus disputed?
2. What defaults should N, the panel and `maxCalls` have?
3. Should `checks-agree` be on by default once calibration agrees with Jev?
4. Is Phase A enough?
5. Should the four core changes land in 1.0-rc, or in a 1.1?
6. Is `always` the right name, given XState uses it for guarded eventless transitions without work?
