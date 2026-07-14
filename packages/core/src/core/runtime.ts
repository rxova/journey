import { LOADING_ASYNC, SUCCESS_ASYNC } from "./helpers";
import { JourneyStore } from "./store";
import type {
  AnyHookArgs,
  AnyOnEffect,
  NavigationFailure,
  RuntimeConfig,
  RuntimeTransition,
  TimelineOp,
  TransitionListener
} from "./runtime.types";
import {
  MAX_RAISED_EVENTS,
  type ContextUpdater,
  type CurrentStepBase,
  type JourneyEventObject,
  type JourneyOutcome,
  type JourneySnapshot,
  type JourneyStatus,
  type NavigationResult,
  type PluginHost,
  type StepAsyncState
} from "./types";

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
  private pending: { phase: "leaving" | "entering"; from: string | null; to: string } | null = null;
  private disposed = false;
  /** Bumped by terminate/restart/dispose so stale hook continuations bail out. */
  private generation = 0;
  private raiseQueue: JourneyEventObject[] = [];
  private processingRaised = false;
  private lastPluginExtensions: Readonly<Record<string, unknown>> = {};
  private readonly transitionListeners = new Set<TransitionListener>();
  private readonly disposeCallbacks: (() => void)[] = [];
  private readonly snapshotDerivers = new Map<
    string,
    (snapshot: JourneySnapshot, previous: unknown) => unknown
  >();

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.context = config.initialContext;
    this.store = new JourneyStore(this.buildSnapshot());
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
    this.context = this.config.initialContext;
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
    this.transitionListeners.clear();
    this.store.dispose();
  }

  // ── context ──────────────────────────────────────────────────────────────

  updateContext(updater: ContextUpdater<unknown>): void {
    if (this.disposed) return;
    const previous = this.context;
    this.context = updater(previous);
    const snapshot = this.publish();
    this.store.emit("contextChange", { snapshot, previous, current: this.context });
  }

  // ── navigation ───────────────────────────────────────────────────────────

  goToStepById(id: string): Promise<NavigationResult> {
    const rejected = this.checkNavigable();
    if (rejected) return this.blocked(rejected, id);
    if (!(id in this.config.steps))
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

  goToPreviousStep(n = 1): Promise<NavigationResult> {
    const rejected = this.checkNavigable();
    if (rejected) return this.blocked(rejected, null);
    if (this.currentIndex <= 0) return this.blocked({ ok: false, reason: "out-of-bounds" }, null);
    const index = Math.max(0, this.currentIndex - Math.max(1, Math.floor(n)));
    const target = this.timeline[index] as string;
    return this.runNavigation(target, { kind: "pointer", index }, null, null);
  }

  goToNextStep(): Promise<NavigationResult> {
    const rejected = this.checkNavigable();
    if (rejected) return this.blocked(rejected, null);
    if (this.currentIndex < this.timeline.length - 1) {
      const index = this.currentIndex + 1;
      const target = this.timeline[index] as string;
      return this.runNavigation(target, { kind: "pointer", index }, null, null);
    }
    if (this.config.kind === "linear") {
      const orderIndex = this.config.stepIds.indexOf(this.currentStepId() ?? "");
      const target = this.config.stepIds[orderIndex + 1];
      if (target === undefined) return this.blocked({ ok: false, reason: "out-of-bounds" }, null);
      return this.runNavigation(target, { kind: "append" }, null, null);
    }
    return this.blocked({ ok: false, reason: "out-of-bounds" }, null);
  }

  goToLastVisitedStep(): Promise<NavigationResult> {
    const rejected = this.checkNavigable();
    if (rejected) return this.blocked(rejected, null);
    const tip = this.timeline.length - 1;
    if (this.currentIndex >= tip) return this.blocked({ ok: false, reason: "no-op" }, null);
    const target = this.timeline[tip] as string;
    return this.runNavigation(target, { kind: "pointer", index: tip }, null, null);
  }

  /** Graph-only primary verb; also drives raised events. */
  send(type: string, payload?: unknown): Promise<NavigationResult> {
    const rejected = this.checkNavigable();
    if (rejected) return this.blocked(rejected, null);
    const transition = this.config.transitions.find(
      (candidate) =>
        candidate.event === type &&
        candidate.from === this.currentStepId() &&
        this.isEnabled(candidate)
    );
    if (!transition) {
      return this.blocked({ ok: false, reason: "no-enabled-transition" }, null);
    }
    const event: JourneyEventObject =
      payload === undefined ? { type } : ({ type, payload } as JourneyEventObject);
    return this.runNavigation(transition.to, { kind: "append" }, event, transition);
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
    for (const plugin of this.config.plugins) {
      if (plugin.name in this.pluginApis) {
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
  }

  // ── internals ────────────────────────────────────────────────────────────

  private currentStepId(): string | null {
    return this.currentIndex >= 0 ? (this.timeline[this.currentIndex] as string) : null;
  }

  private eventFor(transition: RuntimeTransition): JourneyEventObject {
    return { type: transition.event };
  }

  private isEnabled(transition: RuntimeTransition): boolean {
    if (!transition.when) return true;
    try {
      return transition.when({ context: this.context, handlers: this.config.handlers });
    } catch {
      return false;
    }
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
    const to = this.config.initial;
    this.pending = { phase: "entering", from: null, to };
    this.timeline = [to];
    this.currentIndex = 0;
    this.commitEntry(null, to);
    await this.runEntryEffects(null, to, null, null, generation);
  }

  private async runNavigation(
    to: string,
    op: TimelineOp,
    event: JourneyEventObject | null,
    transition: RuntimeTransition | null
  ): Promise<NavigationResult> {
    const generation = this.generation;
    const from = this.currentStepId();
    this.pending = { phase: "leaving", from, to };
    this.publish();

    // onLeave — async + blocking: `false` (sync or via promise) cancels.
    const fromStep = from === null ? undefined : this.config.steps[from];
    if (fromStep?.onLeave) {
      let leaveResult: boolean | void;
      try {
        leaveResult = await this.withTimeout(
          Promise.resolve(fromStep.onLeave(this.hookArgs(from, to, event))),
          `onLeave(${from ?? ""})`
        );
      } catch (error) {
        if (!this.isCurrent(generation)) return this.staleResult();
        this.pending = null;
        this.publish();
        return this.blocked({ ok: false, reason: "error", error }, to);
      }
      if (!this.isCurrent(generation)) return this.staleResult();
      if (leaveResult === false) {
        this.pending = null;
        this.publish();
        return this.blocked({ ok: false, reason: "blocked" }, to);
      }
    }
    if (!this.isCurrent(generation)) return this.staleResult();

    // Commit: timeline updates, snapshot emission, stepLeave/stepEnter events.
    if (op.kind === "pointer") {
      this.currentIndex = op.index;
    } else {
      this.timeline = [...this.timeline.slice(0, this.currentIndex + 1), to];
      this.currentIndex = this.timeline.length - 1;
    }
    this.pending = { phase: "entering", from, to };
    this.commitEntry(from, to);

    await this.runEntryEffects(from, to, event, transition, generation);
    if (!this.isCurrent(generation)) return this.staleResult();
    return { ok: true, from, to };
  }

  /** Shared commit bookkeeping for navigations and the initial entry. */
  private commitEntry(from: string | null, to: string): void {
    this.visitCounts.set(to, (this.visitCounts.get(to) ?? 0) + 1);
    const toStep = this.config.steps[to];
    this.entryAsync = toStep?.onEnter ? LOADING_ASYNC : SUCCESS_ASYNC;
    const snapshot = this.publish();
    if (from !== null) this.store.emit("stepLeave", { snapshot, from, to });
    this.store.emit("stepEnter", { snapshot, from, to });
  }

  /** Post-commit effects: transition `onTransition`, then step `onEnter`. */
  private async runEntryEffects(
    from: string | null,
    to: string,
    event: JourneyEventObject | null,
    transition: RuntimeTransition | null,
    generation: number
  ): Promise<void> {
    const toStep = this.config.steps[to];
    let failure: { error: unknown; phase: "enter" | "transition" } | null = null;

    const transitionFailure = await this.invokeEffect(
      transition?.onTransition,
      this.hookArgs(from, to, event),
      `onTransition(${event?.type ?? ""})`
    );
    if (!this.isCurrent(generation)) return;
    if (transitionFailure) {
      failure = { error: transitionFailure.error, phase: "transition" };
    } else {
      const enterFailure = await this.invokeEffect(
        toStep?.onEnter,
        this.hookArgs(from, to, event),
        `onEnter(${to})`
      );
      if (!this.isCurrent(generation)) return;
      if (enterFailure) failure = { error: enterFailure.error, phase: "enter" };
    }

    this.entryAsync = failure
      ? Object.freeze({ isLoading: false, isSuccess: false, isError: true, error: failure.error })
      : SUCCESS_ASYNC;
    this.pending = null;
    const snapshot = this.publish();
    if (failure) {
      this.store.emit("error", {
        snapshot,
        error: failure.error,
        phase: failure.phase,
        stepId: to
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
    const currentId = this.currentStepId();
    const visited: Record<string, boolean> = {};
    let visitedStepCount = 0;
    for (const id of this.config.stepIds) {
      const seen = (this.visitCounts.get(id) ?? 0) > 0;
      visited[id] = seen;
      if (seen) visitedStepCount += 1;
    }

    const base = {
      status: this.status,
      context: this.context,
      transition: Object.freeze({
        pending: this.pending !== null,
        phase: this.pending?.phase ?? null,
        from: this.pending?.from ?? null,
        to: this.pending?.to ?? null
      }),
      history: Object.freeze({
        timeline: Object.freeze([...this.timeline]) as readonly string[],
        currentIndex: this.currentIndex,
        visited: Object.freeze(visited),
        canGoBack: this.currentIndex > 0,
        canGoForward: this.currentIndex >= 0 && this.currentIndex < this.timeline.length - 1
      }),
      outcome: this.outcome,
      machine: Object.freeze({
        isLoading: this.pending !== null,
        isIdle: this.status === "idle",
        isRunning: this.status === "running",
        isPaused: this.status === "paused",
        isCompleted: this.status === "completed",
        isTerminated: this.status === "terminated"
      })
    };

    const currentBase: CurrentStepBase<string, unknown> | null =
      currentId === null
        ? null
        : {
            id: currentId,
            metadata: this.config.steps[currentId]?.metadata ?? {},
            isFirstTimeVisit: (this.visitCounts.get(currentId) ?? 0) === 1,
            async: this.entryAsync
          };

    let snapshot: JourneySnapshot;
    if (this.config.kind === "linear") {
      const orderIndex = currentId === null ? -1 : this.config.stepIds.indexOf(currentId);
      snapshot = {
        ...base,
        type: "linear",
        currentStep:
          currentBase === null
            ? null
            : Object.freeze({
                ...currentBase,
                index: orderIndex,
                isFirstStep: orderIndex === 0,
                isLastStep: orderIndex === this.config.stepIds.length - 1
              }),
        steps: Object.freeze({
          totalSteps: this.config.stepIds.length,
          stepOrder: Object.freeze([...this.config.stepIds]) as readonly string[],
          visitedStepCount
        }),
        plugins: {}
      } as JourneySnapshot;
    } else {
      const availableEvents: string[] = [];
      const availableSteps: string[] = [];
      let hasOutgoing = false;
      if (currentId !== null) {
        for (const transition of this.config.transitions) {
          if (transition.from !== currentId) continue;
          hasOutgoing = true;
          if (!this.isEnabled(transition)) continue;
          if (!availableEvents.includes(transition.event)) availableEvents.push(transition.event);
          if (!availableSteps.includes(transition.to)) availableSteps.push(transition.to);
        }
      }
      snapshot = {
        ...base,
        type: "graph",
        currentStep:
          currentBase === null ? null : Object.freeze({ ...currentBase, isTerminal: !hasOutgoing }),
        steps: Object.freeze({ totalSteps: this.config.stepIds.length, visitedStepCount }),
        availableEvents: Object.freeze(availableEvents) as readonly string[],
        availableSteps: Object.freeze(availableSteps) as readonly string[],
        plugins: {}
      } as JourneySnapshot;
    }

    if (this.snapshotDerivers.size > 0) {
      const extensions: Record<string, unknown> = {};
      for (const [name, derive] of this.snapshotDerivers) {
        extensions[name] = derive(snapshot, this.lastPluginExtensions[name]);
      }
      this.lastPluginExtensions = extensions;
      snapshot = { ...snapshot, plugins: Object.freeze(extensions) } as JourneySnapshot;
    }
    return Object.freeze(snapshot) as JourneySnapshot;
  }
}
