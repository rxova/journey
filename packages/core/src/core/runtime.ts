import { isDevelopmentEnvironment, warnInDevelopment } from "@rxova/journey-common/dev";
import {
  eventWorkKey,
  hasOwn,
  LOADING_ASYNC,
  MAX_RAISED_EVENTS,
  shallowEqual,
  SUCCESS_ASYNC
} from "./helpers";
import { JourneyStore } from "./store";
import type {
  AnyHookArgs,
  AnyNavigationWork,
  AnyOnEffect,
  AnySendWork,
  AnySendWorkArgs,
  NavigationFailure,
  RuntimeConfig,
  RuntimeTransition,
  TimelineOp,
  TransitionListener,
  WorkDirection
} from "./runtime.types";
import type {
  ContextUpdater,
  CurrentStepBase,
  JourneyEventObject,
  GraphTransitionSnapshot,
  JourneyOutcome,
  JourneySnapshot,
  JourneyStatus,
  NavigationResult,
  PluginHost,
  StepAsyncState,
  StepEnterDirection
} from "./types";

/**
 * Dev-only shallow freeze of the context.
 *
 * Every other snapshot slice is frozen, so an unfrozen context is a surprising
 * gap: mutating it in place changes nothing the machine can observe — no
 * publish, no re-render, no subscriber — and the bug is silent. Freezing turns
 * it into a throw where it happens.
 *
 * Shallow, matching how the rest of the snapshot is frozen; deep-freezing would
 * cost a full walk per update and break Maps, Dates, and class instances that
 * legitimately live in a context. Development only, so production pays nothing.
 */
const freezeContextInDevelopment = <T>(context: T): T =>
  typeof context === "object" && context !== null && isDevelopmentEnvironment()
    ? Object.freeze(context)
    : context;

const EMPTY_METADATA: Readonly<Record<string, unknown>> = Object.freeze({});
const EMPTY_PLUGINS: Readonly<Record<string, unknown>> = Object.freeze({});

/** Freezes and returns the rebuilt sub-object, or the previous one when content-equal. */
const shared = <T extends object>(next: T, previous: T | null | undefined): T =>
  previous != null &&
  shallowEqual(next as Record<string, unknown>, previous as Record<string, unknown>)
    ? previous
    : Object.freeze(next);

/** Reuses the previous frozen array when elements are pairwise equal. */
const sharedArray = <T>(
  next: readonly T[],
  previous: readonly T[] | undefined,
  equal: (a: T, b: T) => boolean = Object.is
): readonly T[] =>
  previous !== undefined &&
  previous.length === next.length &&
  next.every((item, index) => equal(item, previous[index] as T))
    ? previous
    : (Object.freeze([...next]) as readonly T[]);

const getGraphGuardState = (
  guard: RuntimeTransition["when"],
  enabled: boolean
): GraphTransitionSnapshot<string, string>["guard"] => {
  if (guard === undefined) return "none";
  return enabled ? "passed" : "failed";
};

export class JourneyRuntime {
  readonly store: JourneyStore<unknown, string>;
  readonly pluginApis: Record<string, unknown> = {};

  private readonly config: RuntimeConfig;
  private status: JourneyStatus = "idle";
  private timeline: string[] = [];
  private currentIndex = -1;
  private context: unknown;
  private outcome: JourneyOutcome | null = null;
  private visitCounts = new Map<string, number>();
  private entryAsync: StepAsyncState = SUCCESS_ASYNC;
  private pending: {
    phase: "working" | "leaving" | "entering";
    from: string | null;
    /** Null while a graph send runs its work: the target is not resolved yet. */
    to: string | null;
  } | null = null;
  private disposed = false;
  /** One-shot seed for the first start(); restart() always enters fresh. */
  private restoreSeed: RuntimeConfig["restore"] | null = null;
  /** Bumped by terminate/restart/dispose so stale hook continuations bail out. */
  private generation = 0;
  private raiseQueue: JourneyEventObject[] = [];
  private processingRaised = false;
  private lastPluginExtensions: Readonly<Record<string, unknown>> = {};
  /** The last built snapshot — the sharing baseline for buildSnapshot(). */
  private lastSnapshot: JourneySnapshot | null = null;
  private readonly frozenStepOrder: readonly string[];
  /**
   * Per-step registration stacks, innermost last. Resolution is last-wins, but
   * a stack (rather than a single slot) is what lets an unregister restore the
   * registration it shadowed — two owners guarding one step is the normal case
   * for component-scoped wrappers, and dropping to "ungated" when the newer one
   * unmounts would fail silently.
   */
  private readonly nextStepInterceptors = new Map<string, AnyNavigationWork[]>();
  private readonly transitionListeners = new Set<TransitionListener>();
  private readonly disposeCallbacks: (() => void)[] = [];
  private readonly snapshotDerivers = new Map<
    string,
    (snapshot: JourneySnapshot, previous: unknown) => unknown
  >();

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.frozenStepOrder = Object.freeze([...config.stepIds]) as readonly string[];
    this.restoreSeed = config.restore ?? null;
    this.context = freezeContextInDevelopment(
      config.restore ? config.restore.context : config.initialContext
    );
    this.store = new JourneyStore(this.buildSnapshot(), config.onListenerError);
    this.setupPlugins();
    this.store.publish(this.buildSnapshot());
    if (config.autoStart) this.start();
  }

  // ── lifecycle ────────────────────────────────────────────────────────────

  start(): boolean {
    if (this.disposed || this.status !== "idle") return false;
    this.setStatus("running");
    void this.enterInitialStep();
    return true;
  }

  pause(): boolean {
    if (this.disposed || this.status !== "running" || this.pending) return false;
    this.setStatus("paused");
    return true;
  }

  resume(): boolean {
    if (this.disposed || this.status !== "paused") return false;
    this.setStatus("running");
    return true;
  }

  complete(payload?: unknown): boolean {
    if (this.disposed || this.status !== "running" || this.pending) return false;
    this.outcome = Object.freeze({ type: "completed", payload }) as JourneyOutcome;
    this.setStatus("completed");
    return true;
  }

  terminate(payload?: unknown): boolean {
    if (this.disposed || this.status === "terminated") return false;
    this.generation += 1;
    this.pending = null;
    this.entryAsync = SUCCESS_ASYNC;
    this.raiseQueue = [];
    this.outcome = Object.freeze({ type: "terminated", payload }) as JourneyOutcome;
    this.setStatus("terminated");
    return true;
  }

  restart(): boolean {
    if (this.disposed || (this.status !== "completed" && this.status !== "terminated")) {
      return false;
    }
    this.generation += 1;
    this.pending = null;
    this.raiseQueue = [];
    this.timeline = [];
    this.currentIndex = -1;
    this.context = freezeContextInDevelopment(this.config.initialContext);
    this.outcome = null;
    this.visitCounts = new Map();
    this.entryAsync = SUCCESS_ASYNC;
    this.setStatus("running");
    void this.enterInitialStep();
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.pending = null;
    this.raiseQueue = [];
    for (const callback of this.disposeCallbacks.splice(0)) {
      try {
        callback();
      } catch {
        // dispose callbacks must never break teardown
      }
    }
    this.nextStepInterceptors.clear();
    this.transitionListeners.clear();
    this.store.dispose();
  }

  // ── context ──────────────────────────────────────────────────────────────

  updateContext(updater: ContextUpdater<unknown>): void {
    if (this.disposed) return;
    const previous = this.context;
    this.context = freezeContextInDevelopment(updater(previous));
    const snapshot = this.publish();
    this.store.emit("contextChange", { snapshot, previous, current: this.context });
  }

  clearAsyncError(): void {
    if (this.disposed || !this.entryAsync.isError) return;
    this.entryAsync = SUCCESS_ASYNC;
    this.publish();
  }

  // ── navigation ───────────────────────────────────────────────────────────

  goToStepById(id: string): Promise<NavigationResult> {
    const rejected = this.checkNavigable();
    if (rejected) return this.blocked(rejected, id);
    if (!hasOwn(this.config.steps, id))
      return this.blocked({ ok: false, reason: "invalid-target" }, id);
    if (id === this.currentStepId()) return this.blocked({ ok: false, reason: "no-op" }, id);

    if (this.config.kind === "graph") {
      const transition = this.config.transitions.find(
        (candidate) =>
          candidate.from === this.currentStepId() &&
          candidate.to === id &&
          this.isEnabled(candidate)
      );
      if (!transition) return this.blocked({ ok: false, reason: "invalid-target" }, id);
      return this.runNavigation(id, { kind: "append" }, this.eventFor(transition), transition);
    }
    return this.runNavigation(id, { kind: "append" }, null, null);
  }

  goToPreviousStep(
    nOrWork: number | AnyNavigationWork = 1,
    suppliedWork?: AnyNavigationWork
  ): Promise<NavigationResult> {
    const rejected = this.checkNavigable();
    if (rejected) return this.blocked(rejected, null);
    if (this.currentIndex <= 0) return this.blocked({ ok: false, reason: "out-of-bounds" }, null);
    const n = typeof nOrWork === "number" ? nOrWork : 1;
    const work = typeof nOrWork === "number" ? suppliedWork : nOrWork;
    const index = Math.max(0, this.currentIndex - Math.max(1, Math.floor(n)));
    const target = this.timeline[index] as string;
    return this.runNavigation(target, { kind: "pointer", index }, null, null, work, "backward");
  }

  goToNextStep(work?: AnyNavigationWork): Promise<NavigationResult> {
    const rejected = this.checkNavigable();
    if (rejected) return this.blocked(rejected, null);
    const registered = this.nextStepInterceptors.get(this.currentStepId() as string);
    const effectiveWork = work ?? registered?.[registered.length - 1];
    if (this.currentIndex < this.timeline.length - 1) {
      const index = this.currentIndex + 1;
      const target = this.timeline[index] as string;
      return this.runNavigation(
        target,
        { kind: "pointer", index },
        null,
        null,
        effectiveWork,
        "forward"
      );
    }
    if (this.config.kind === "linear") {
      const orderIndex = this.config.stepIds.indexOf(this.currentStepId() ?? "");
      const target = this.config.stepIds[orderIndex + 1];
      if (target === undefined) return this.blocked({ ok: false, reason: "out-of-bounds" }, null);
      return this.runNavigation(target, { kind: "append" }, null, null, effectiveWork, "forward");
    }
    return this.blocked({ ok: false, reason: "out-of-bounds" }, null);
  }

  /**
   * Registers forward-navigation work for `stepId`, consulted by `goToNextStep`
   * when no explicit work is passed. Last registration wins; the returned
   * unsubscribe removes only its own registration, so unregistering the active
   * one reinstates whichever registration it had shadowed.
   */
  registerNextStepInterceptor(stepId: string, work: AnyNavigationWork): () => void {
    if (!hasOwn(this.config.steps, stepId)) {
      throw new Error(`journey: registerNextStepInterceptor references unknown step "${stepId}"`);
    }
    const stack = this.nextStepInterceptors.get(stepId);
    if (stack) {
      warnInDevelopment(
        `journey: shadowed a live registration for step "${stepId}" — last registration wins.`
      );
      stack.push(work);
    } else {
      this.nextStepInterceptors.set(stepId, [work]);
    }
    return () => {
      const live = this.nextStepInterceptors.get(stepId);
      if (!live) return;
      const index = live.lastIndexOf(work);
      if (index < 0) return;
      live.splice(index, 1);
      if (!live.length) this.nextStepInterceptors.delete(stepId);
    };
  }

  goToLastVisitedStep(): Promise<NavigationResult> {
    const rejected = this.checkNavigable();
    if (rejected) return this.blocked(rejected, null);
    const tip = this.timeline.length - 1;
    if (this.currentIndex >= tip) return this.blocked({ ok: false, reason: "no-op" }, null);
    const target = this.timeline[tip] as string;
    return this.runNavigation(target, { kind: "pointer", index: tip }, null, null);
  }

  /** Linear-only: declared-order index navigation, delegating to `goToStepById`. */
  goToStepByIndex(index: number): Promise<NavigationResult> {
    const target = Number.isInteger(index) ? this.config.stepIds[index] : undefined;
    if (target === undefined) {
      return this.blocked({ ok: false, reason: "invalid-target" }, null);
    }
    return this.goToStepById(target);
  }

  /** Graph-only primary verb; also drives raised events. */
  send(type: string, payload?: unknown, work?: AnySendWork): Promise<NavigationResult> {
    const rejected = this.checkNavigable();
    if (rejected) return this.blocked(rejected, null);
    const event: JourneyEventObject =
      payload === undefined ? { type } : ({ type, payload } as JourneyEventObject);

    const from = this.currentStepId();
    const declaredWork =
      work ?? (from === null ? undefined : this.config.eventWork?.[eventWorkKey(from, type)]);
    if (declaredWork) return this.sendWithWork(type, event, declaredWork);

    const transition = this.resolveTransition(type);
    if (!transition) {
      return this.blocked({ ok: false, reason: "no-enabled-transition" }, null);
    }
    return this.runNavigation(transition.to, { kind: "append" }, event, transition);
  }

  /**
   * Work-carrying send: the async runs *before* routing, so its `commit` can
   * stage the very context the guards are then evaluated against. Guards stay
   * sync and pure — the work supplies facts, the definition still picks the
   * edge.
   *
   * The machine holds its position for the whole `working` phase (`pending.to`
   * is null: there is no target yet). If no candidate is enabled once the
   * context is staged, the staged context is discarded and nothing is
   * published — either the send routed and committed, or neither happened.
   */
  private async sendWithWork(
    type: string,
    event: JourneyEventObject,
    work: AnySendWork
  ): Promise<NavigationResult> {
    const generation = this.generation;
    const from = this.currentStepId();
    if (from === null) return this.blocked({ ok: false, reason: "not-running" }, null);

    let stagedContext = this.context;
    let contextWasUpdated = false;
    let result: unknown;

    this.pending = { phase: "working", from, to: null };
    this.entryAsync = LOADING_ASYNC;
    this.publish();

    try {
      const args: AnySendWorkArgs = {
        snapshot: this.store.getSnapshot(),
        from,
        event,
        handlers: this.config.handlers
      };
      result = await this.withTimeout(
        Promise.resolve(work.run(args)),
        `send work(${type} from ${from})`
      );
      if (!this.isCurrent(generation)) return this.staleResult();
      const commitResult = (work.commit as ((value: unknown) => unknown) | undefined)?.({
        ...args,
        result,
        updateContext: (updater: ContextUpdater<unknown>) => {
          stagedContext = updater(stagedContext);
          contextWasUpdated = true;
        }
      });
      if (typeof commitResult === "object" && commitResult !== null && "then" in commitResult) {
        throw new Error("journey: send work commit must be synchronous");
      }
    } catch (error) {
      if (!this.isCurrent(generation)) return this.staleResult();
      this.pending = null;
      this.entryAsync = Object.freeze({
        isLoading: false,
        isSuccess: false,
        isError: true,
        error
      });
      const snapshot = this.publish();
      this.store.emit("error", { snapshot, error, phase: "work", stepId: from });
      return this.blocked({ ok: false, reason: "error", error }, null);
    }

    if (!this.isCurrent(generation)) return this.staleResult();

    // Route against the staged context, not the committed one; the guards also
    // see the run result directly, so transient outcomes need not be persisted.
    const transition = this.resolveTransition(type, stagedContext, result);
    if (!transition) {
      // Roll back: the staged context is dropped along with the move.
      this.pending = null;
      this.entryAsync = SUCCESS_ASYNC;
      this.publish();
      return this.blocked({ ok: false, reason: "no-enabled-transition" }, null);
    }

    return this.commitAndSettle(
      from,
      transition.to,
      { kind: "append" },
      event,
      transition,
      generation,
      stagedContext,
      contextWasUpdated,
      "jump"
    );
  }

  // ── plugin host ──────────────────────────────────────────────────────────

  private setupPlugins(): void {
    const host: PluginHost = {
      getSnapshot: () => this.store.getSnapshot(),
      structure: Object.freeze({
        kind: this.config.kind,
        stepIds: Object.freeze([...this.config.stepIds]) as readonly string[],
        initial: this.config.initial,
        transitions: Object.freeze(
          this.config.transitions.map((transition) =>
            Object.freeze({
              event: transition.event,
              from: transition.from,
              to: transition.to,
              guarded: transition.when !== undefined
            })
          )
        )
      }),
      onTransition: (callback) => {
        this.transitionListeners.add(callback as TransitionListener);
        return () => this.transitionListeners.delete(callback as TransitionListener);
      },
      onStepEnter: (callback) => this.store.subscribeEvent("stepEnter", callback),
      onStepLeave: (callback) => this.store.subscribeEvent("stepLeave", callback),
      onNavigationBlocked: (callback) => this.store.subscribeEvent("navigationBlocked", callback),
      onStatusChange: (callback) => this.store.subscribeEvent("statusChange", callback),
      onContextChange: (callback) => this.store.subscribeEvent("contextChange", callback),
      onError: (callback) => this.store.subscribeEvent("error", callback),
      onDispose: (callback) => {
        this.disposeCallbacks.push(callback);
      }
    };
    // A failure part-way through leaves earlier plugins already subscribed and
    // holding onDispose callbacks — but the machine is never returned, so
    // dispose() is unreachable and their timers and subscriptions would live
    // for the process lifetime. Tear down before rethrowing, so a rejected
    // construction leaks nothing.
    try {
      for (const plugin of this.config.plugins) {
        if (hasOwn(this.pluginApis, plugin.name)) {
          throw new Error(`journey: duplicate plugin name "${plugin.name}"`);
        }
        const contribution = plugin.setup(host);
        this.pluginApis[plugin.name] = contribution.api;
        if (contribution.deriveSnapshot) {
          this.snapshotDerivers.set(
            plugin.name,
            contribution.deriveSnapshot as (snapshot: JourneySnapshot, previous: unknown) => unknown
          );
        }
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  // ── internals ────────────────────────────────────────────────────────────

  private currentStepId(): string | null {
    return this.currentIndex >= 0 ? (this.timeline[this.currentIndex] as string) : null;
  }

  private eventFor(transition: RuntimeTransition): JourneyEventObject {
    return { type: transition.event };
  }

  /**
   * `context` is explicit so a work-carrying `send` can evaluate guards against
   * the context its `commit` just staged, rather than the committed one.
   * `result` is the work's run result during that same routing pass; outside a
   * work send (plain sends, snapshot introspection) guards see it as undefined.
   */
  private isEnabled(
    transition: RuntimeTransition,
    context: unknown = this.context,
    result?: unknown
  ): boolean {
    if (!transition.when) return true;
    try {
      return transition.when({ context, handlers: this.config.handlers, result });
    } catch {
      return false;
    }
  }

  /** First enabled candidate for `event` from the current step, in declaration order. */
  private resolveTransition(
    event: string,
    context: unknown = this.context,
    result?: unknown
  ): RuntimeTransition | undefined {
    return this.config.transitions.find(
      (candidate) =>
        candidate.event === event &&
        candidate.from === this.currentStepId() &&
        this.isEnabled(candidate, context, result)
    );
  }

  private checkNavigable(): NavigationFailure | null {
    if (this.disposed) return { ok: false, reason: "disposed" };
    if (this.status !== "running") return { ok: false, reason: "not-running" };
    if (this.pending) return { ok: false, reason: "transitioning" };
    return null;
  }

  private setStatus(next: JourneyStatus): void {
    const previous = this.status;
    this.status = next;
    const snapshot = this.publish();
    this.store.emit("statusChange", { snapshot, previous, current: next });
    // Plugin taps may have updated state the snapshot derives from.
    this.refreshPluginSnapshot();
  }

  /** Re-derives `snapshot.plugins` after plugin taps ran post-publish. */
  private refreshPluginSnapshot(): void {
    if (this.snapshotDerivers.size > 0) this.publish();
  }

  private blocked(failure: NavigationFailure, target: string | null): Promise<NavigationResult> {
    if (failure.reason !== "disposed") {
      const payload: {
        snapshot: JourneySnapshot;
        reason: NavigationFailure["reason"];
        from: string | null;
        to: string | null;
        error?: unknown;
      } = {
        snapshot: this.store.getSnapshot(),
        reason: failure.reason,
        from: this.currentStepId(),
        to: target
      };
      if ("error" in failure) payload.error = failure.error;
      this.store.emit("navigationBlocked", payload);
    }
    return Promise.resolve(failure);
  }

  private hookArgs(from: string | null, to: string, event: JourneyEventObject | null): AnyHookArgs {
    return {
      snapshot: this.store.getSnapshot(),
      from,
      to,
      event,
      updateContext: (updater) => this.updateContext(updater),
      raise: (raised) => {
        if (this.config.kind !== "graph" || this.disposed) return;
        this.raiseQueue.push(raised);
      }
    };
  }

  private async invokeEffect(
    effect: AnyOnEffect | undefined,
    args: AnyHookArgs,
    label: string
  ): Promise<{ error: unknown } | null> {
    if (!effect) return null;
    try {
      await this.withTimeout(Promise.resolve(effect(args)), label);
      return null;
    } catch (error) {
      return { error };
    }
  }

  private withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    const ms = this.config.defaultTimeoutMs;
    if (ms === undefined) return promise;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`journey: ${label} timed out after ${ms}ms`)),
        ms
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  /** Entry on start()/restart(): no onLeave, `from` is null, event is null. */
  private async enterInitialStep(): Promise<void> {
    const generation = this.generation;
    const seed = this.restoreSeed;
    this.restoreSeed = null;
    if (seed) {
      const to = seed.timeline[seed.currentIndex] as string;
      this.pending = { phase: "entering", from: null, to };
      this.timeline = [...seed.timeline];
      this.currentIndex = seed.currentIndex;
      // Persisted records carry no visit counts; occurrences in the restored
      // timeline are the best-effort reconstruction. commitEntry adds one more
      // for the re-entered current step, so it reports isFirstTimeVisit: false.
      for (const id of seed.timeline) {
        this.visitCounts.set(id, (this.visitCounts.get(id) ?? 0) + 1);
      }
      this.commitEntry(null, to, "jump");
      await this.runEntryEffects(null, to, null, null, generation);
      return;
    }
    const to = this.config.startAt ?? this.config.initial;
    this.pending = { phase: "entering", from: null, to };
    this.timeline = [to];
    this.currentIndex = 0;
    this.commitEntry(null, to, "jump");
    await this.runEntryEffects(null, to, null, null, generation);
  }

  private async runNavigation(
    to: string,
    op: TimelineOp,
    event: JourneyEventObject | null,
    transition: RuntimeTransition | null,
    work?: AnyNavigationWork,
    direction?: WorkDirection
  ): Promise<NavigationResult> {
    const generation = this.generation;
    const from = this.currentStepId();
    let stagedContext = this.context;
    let contextWasUpdated = false;

    if (work && from !== null && direction) {
      this.pending = { phase: "working", from, to };
      this.entryAsync = LOADING_ASYNC;
      this.publish();

      try {
        const args = {
          snapshot: this.store.getSnapshot(),
          from,
          to,
          direction
        };
        const result = await this.withTimeout(
          Promise.resolve(work.run(args)),
          `${direction} navigation work(${from} -> ${to})`
        );
        if (!this.isCurrent(generation)) return this.staleResult();
        const commitResult = (work.commit as ((value: unknown) => unknown) | undefined)?.({
          ...args,
          result,
          updateContext: (updater: ContextUpdater<unknown>) => {
            stagedContext = updater(stagedContext);
            contextWasUpdated = true;
          }
        });
        if (typeof commitResult === "object" && commitResult !== null && "then" in commitResult) {
          throw new Error("journey: navigation work commit must be synchronous");
        }
      } catch (error) {
        if (!this.isCurrent(generation)) return this.staleResult();
        this.pending = null;
        this.entryAsync = Object.freeze({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error
        });
        const snapshot = this.publish();
        this.store.emit("error", { snapshot, error, phase: "work", stepId: from });
        return this.blocked({ ok: false, reason: "error", error }, to);
      }
    }
    if (!this.isCurrent(generation)) return this.staleResult();

    return this.commitAndSettle(
      from,
      to,
      op,
      event,
      transition,
      generation,
      stagedContext,
      contextWasUpdated,
      direction ?? "jump"
    );
  }

  /**
   * Publishes the position change and any staged context in one snapshot, then
   * awaits the post-commit effects. Shared by plain navigation and by a
   * work-carrying `send`, which reaches here only once its target is resolved.
   */
  private async commitAndSettle(
    from: string | null,
    to: string,
    op: TimelineOp,
    event: JourneyEventObject | null,
    transition: RuntimeTransition | null,
    generation: number,
    stagedContext: unknown,
    contextWasUpdated: boolean,
    direction: StepEnterDirection
  ): Promise<NavigationResult> {
    const previousContext = this.context;
    if (op.kind === "pointer") {
      this.currentIndex = op.index;
    } else {
      this.timeline = [...this.timeline.slice(0, this.currentIndex + 1), to];
      this.currentIndex = this.timeline.length - 1;
    }
    if (contextWasUpdated) this.context = freezeContextInDevelopment(stagedContext);
    const fromStep = from === null ? undefined : this.config.steps[from];
    this.pending = { phase: fromStep?.onLeave ? "leaving" : "entering", from, to };
    this.commitEntry(
      from,
      to,
      direction,
      contextWasUpdated ? { previous: previousContext, current: stagedContext } : undefined,
      fromStep?.onLeave !== undefined || transition?.onTransition !== undefined
    );

    await this.runEntryEffects(from, to, event, transition, generation);
    return { ok: true, from, to };
  }

  /** Shared commit bookkeeping for navigations and the initial entry. */
  private commitEntry(
    from: string | null,
    to: string,
    direction: StepEnterDirection,
    contextChange?: { previous: unknown; current: unknown },
    hasPreEnterEffect = false
  ): void {
    this.visitCounts.set(to, (this.visitCounts.get(to) ?? 0) + 1);
    const toStep = this.config.steps[to];
    this.entryAsync = hasPreEnterEffect || toStep?.onEnter ? LOADING_ASYNC : SUCCESS_ASYNC;
    const snapshot = this.publish();
    if (contextChange) this.store.emit("contextChange", { snapshot, ...contextChange });
    if (from !== null) this.store.emit("stepLeave", { snapshot, from, to });
    this.store.emit("stepEnter", { snapshot, from, to, direction });
  }

  /** Post-commit effects: step `onLeave`, transition effect, then step `onEnter`. */
  private async runEntryEffects(
    from: string | null,
    to: string,
    event: JourneyEventObject | null,
    transition: RuntimeTransition | null,
    generation: number
  ): Promise<void> {
    const fromStep = from === null ? undefined : this.config.steps[from];
    const toStep = this.config.steps[to];
    const failures: { error: unknown; phase: "leave" | "enter" | "transition"; stepId: string }[] =
      [];

    const leaveFailure = await this.invokeEffect(
      fromStep?.onLeave,
      this.hookArgs(from, to, event),
      `onLeave(${from ?? ""})`
    );
    if (!this.isCurrent(generation)) return;
    if (leaveFailure && from !== null) {
      failures.push({ error: leaveFailure.error, phase: "leave", stepId: from });
    }

    this.pending = { phase: "entering", from, to };
    this.publish();

    const transitionFailure = await this.invokeEffect(
      transition?.onTransition,
      this.hookArgs(from, to, event),
      `onTransition(${event?.type ?? ""})`
    );
    if (!this.isCurrent(generation)) return;
    if (transitionFailure) {
      failures.push({ error: transitionFailure.error, phase: "transition", stepId: to });
    }

    const enterFailure = await this.invokeEffect(
      toStep?.onEnter,
      this.hookArgs(from, to, event),
      `onEnter(${to})`
    );
    if (!this.isCurrent(generation)) return;
    if (enterFailure) failures.push({ error: enterFailure.error, phase: "enter", stepId: to });

    this.entryAsync = failures[0]
      ? Object.freeze({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: failures[0].error
        })
      : SUCCESS_ASYNC;
    this.pending = null;
    const snapshot = this.publish();
    for (const failure of failures) {
      this.store.emit("error", {
        snapshot,
        error: failure.error,
        phase: failure.phase,
        stepId: failure.stepId
      });
    }
    for (const listener of [...this.transitionListeners]) {
      try {
        listener({ from, to, snapshot });
      } catch {
        // plugin taps are isolated
      }
    }
    this.refreshPluginSnapshot();
    void this.processRaisedEvents(generation);
  }

  /**
   * Raised events run FIFO after the transition settles; a cascade longer than
   * {@link MAX_RAISED_EVENTS} is dropped and surfaced as an `error` event.
   */
  private async processRaisedEvents(generation: number): Promise<void> {
    if (this.processingRaised || !this.isCurrent(generation)) return;
    this.processingRaised = true;
    let processed = 0;
    try {
      while (this.raiseQueue.length > 0 && this.isCurrent(generation)) {
        if (this.status !== "running") {
          this.raiseQueue = [];
          return;
        }
        processed += 1;
        if (processed > MAX_RAISED_EVENTS) {
          this.raiseQueue = [];
          this.store.emit("error", {
            snapshot: this.store.getSnapshot(),
            error: new Error(
              `journey: raised-event cascade exceeded ${MAX_RAISED_EVENTS} events; queue dropped`
            ),
            phase: "raise",
            stepId: this.currentStepId()
          });
          return;
        }
        const next = this.raiseQueue.shift() as JourneyEventObject;
        // `processingRaised` stays true: the sent event's own settle re-enters
        // processRaisedEvents and must bail so this loop keeps one counter.
        await this.send(next.type, (next as { payload?: unknown }).payload);
      }
    } finally {
      this.processingRaised = false;
    }
  }

  private isCurrent(generation: number): boolean {
    return !this.disposed && generation === this.generation;
  }

  private staleResult(): NavigationResult {
    return this.disposed ? { ok: false, reason: "disposed" } : { ok: false, reason: "not-running" };
  }

  private publish(): JourneySnapshot {
    const snapshot = this.buildSnapshot();
    this.store.publish(snapshot);
    return snapshot;
  }

  // ── snapshot derivation ──────────────────────────────────────────────────

  private buildSnapshot(): JourneySnapshot {
    // Structural sharing: every sub-object reuses the previous snapshot's
    // reference when content-identical, and a fully unchanged snapshot returns
    // the previous object itself — subscribers (and framework bindings diffing
    // by reference) see identity change exactly when content changes.
    const previous = this.lastSnapshot;
    const currentId = this.currentStepId();
    const visitedNext: Record<string, boolean> = {};
    let visitedStepCount = 0;
    for (const id of this.config.stepIds) {
      const seen = (this.visitCounts.get(id) ?? 0) > 0;
      visitedNext[id] = seen;
      if (seen) visitedStepCount += 1;
    }

    const previousHistory = previous?.history;
    const visited =
      previousHistory != null && shallowEqual(previousHistory.visited, visitedNext)
        ? previousHistory.visited
        : (Object.freeze(visitedNext) as Readonly<Record<string, boolean>>);

    const base = {
      status: this.status,
      context: this.context,
      transition: shared(
        {
          pending: this.pending !== null,
          phase: this.pending?.phase ?? null,
          from: this.pending?.from ?? null,
          to: this.pending?.to ?? null
        },
        previous?.transition
      ),
      history: shared(
        {
          timeline: sharedArray(this.timeline, previousHistory?.timeline),
          currentIndex: this.currentIndex,
          visited,
          canGoBack: this.currentIndex > 0,
          canGoForward: this.currentIndex >= 0 && this.currentIndex < this.timeline.length - 1
        },
        previousHistory
      ),
      machine: shared(
        {
          isLoading: this.pending !== null,
          isIdle: this.status === "idle",
          isRunning: this.status === "running",
          isPaused: this.status === "paused",
          isCompleted: this.status === "completed",
          isTerminated: this.status === "terminated",
          outcome: this.outcome
        },
        previous?.machine
      )
    };

    const currentBase: CurrentStepBase<string, unknown> | null =
      currentId === null
        ? null
        : {
            id: currentId,
            metadata: this.config.steps[currentId]?.metadata ?? EMPTY_METADATA,
            isFirstTimeVisit: (this.visitCounts.get(currentId) ?? 0) === 1,
            async: this.entryAsync
          };

    let snapshot: JourneySnapshot;
    if (this.config.kind === "linear") {
      const previousLinear = previous?.type === "linear" ? previous : null;
      const orderIndex = currentId === null ? -1 : this.config.stepIds.indexOf(currentId);
      snapshot = {
        ...base,
        type: "linear",
        currentStep:
          currentBase === null
            ? null
            : shared(
                {
                  ...currentBase,
                  index: orderIndex,
                  isFirstStep: orderIndex === 0,
                  isLastStep: orderIndex === this.config.stepIds.length - 1
                },
                previousLinear?.currentStep
              ),
        steps: shared(
          {
            totalSteps: this.config.stepIds.length,
            stepOrder: this.frozenStepOrder,
            visitedStepCount
          },
          previousLinear?.steps
        ),
        plugins: EMPTY_PLUGINS
      } as JourneySnapshot;
    } else {
      const declaredEvents: string[] = [];
      const availableEvents: string[] = [];
      const availableSteps: string[] = [];
      const outgoingTransitions: GraphTransitionSnapshot<string, string>[] = [];
      const priorities = new Map<string, number>();
      const selectedEvents = new Set<string>();
      let hasOutgoing = false;
      if (currentId !== null) {
        for (const transition of this.config.transitions) {
          if (transition.from !== currentId) continue;
          hasOutgoing = true;
          if (!declaredEvents.includes(transition.event)) declaredEvents.push(transition.event);

          const priority = priorities.get(transition.event) ?? 0;
          priorities.set(transition.event, priority + 1);
          const enabled = this.isEnabled(transition);
          const selected = enabled && !selectedEvents.has(transition.event);
          if (selected) selectedEvents.add(transition.event);
          outgoingTransitions.push(
            Object.freeze({
              event: transition.event,
              to: transition.to,
              priority,
              guard: getGraphGuardState(transition.when, enabled),
              enabled,
              selected
            })
          );

          if (enabled) {
            if (!availableEvents.includes(transition.event)) availableEvents.push(transition.event);
            if (!availableSteps.includes(transition.to)) availableSteps.push(transition.to);
          }
        }
      }
      const previousGraph = previous?.type === "graph" ? previous : null;
      snapshot = {
        ...base,
        type: "graph",
        currentStep:
          currentBase === null
            ? null
            : shared({ ...currentBase, isTerminal: !hasOutgoing }, previousGraph?.currentStep),
        steps: shared(
          { totalSteps: this.config.stepIds.length, visitedStepCount },
          previousGraph?.steps
        ),
        declaredEvents: sharedArray(declaredEvents, previousGraph?.declaredEvents),
        availableEvents: sharedArray(availableEvents, previousGraph?.availableEvents),
        availableSteps: sharedArray(availableSteps, previousGraph?.availableSteps),
        outgoingTransitions: sharedArray(
          outgoingTransitions,
          previousGraph?.outgoingTransitions,
          (a, b) => shallowEqual(a, b as unknown as Record<string, unknown>)
        ),
        plugins: EMPTY_PLUGINS
      } as JourneySnapshot;
    }

    if (this.snapshotDerivers.size > 0) {
      const extensions: Record<string, unknown> = {};
      for (const [name, derive] of this.snapshotDerivers) {
        // Derivers run on every publish and in the constructor, so an
        // unguarded throw here took down every transition. Isolate like any
        // other plugin tap: report, then carry the plugin's previous slice
        // forward so consumers reading snapshot.plugins[name] do not see it
        // blink to undefined.
        try {
          extensions[name] = derive(snapshot, this.lastPluginExtensions[name]);
        } catch (error) {
          this.store.report(error);
          if (hasOwn(this.lastPluginExtensions, name)) {
            extensions[name] = this.lastPluginExtensions[name];
          }
        }
      }
      this.lastPluginExtensions = extensions;
      const previousPlugins = previous?.plugins;
      snapshot = {
        ...snapshot,
        plugins:
          previousPlugins != null && shallowEqual(previousPlugins, extensions)
            ? previousPlugins
            : Object.freeze(extensions)
      } as JourneySnapshot;
    }

    const frozen = Object.freeze(snapshot) as JourneySnapshot;
    const result =
      previous !== null &&
      shallowEqual(
        frozen as unknown as Record<string, unknown>,
        previous as unknown as Record<string, unknown>
      )
        ? previous
        : frozen;
    this.lastSnapshot = result;
    return result;
  }
}
