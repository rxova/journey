import type {
  JourneyControls,
  JourneySubscriptionEvent,
  NavigationResult
} from "@rxova/journey-core";
import type { JourneyDevtoolsOperationResultPayload } from "./protocol.types";

/** Options for `attachJourneyDevtools`. */
export type JourneyDevtoolsBridgeOptions = {
  /** Stable id for this machine in devtools. Defaults to a generated id. */
  machineId?: string;
  /** Human-readable label shown in the devtools panel. */
  label?: string;
  /** Force the bridge on or off. Defaults to enabled only in non-production builds. */
  enabled?: boolean;
  /** App name shown in devtools. Defaults to `document.title`. */
  appName?: string;
  /** Allow devtools to mutate the machine (navigate, patch context). Defaults to non-production. */
  mutationsEnabled?: boolean;
  /**
   * Declared event types shown in the panel. The machine surface exposes only
   * the currently enabled events, so pass the full union here when you want
   * the panel to list every declared event.
   */
  eventTypes?: readonly string[];
  /** Operation rate limiting; mainly a test knob. Defaults to 100 per 10s. */
  rateLimit?: { maxPerWindow?: number; windowMs?: number };
};

/**
 * The machine surface the bridge drives. Own-method parameters use `never`
 * and callback parameters use `unknown` (variance flips once per function
 * nesting) so concretely-typed machines — literal step ids, declared events,
 * typed context — are assignable; the bridge only calls them with validated
 * values through its internal loose view.
 */
export type JourneyDevtoolsAttachableMachine = {
  getSnapshot(): unknown;
  controls: JourneyControls;
  navigate: {
    goToStepById(id: never): Promise<unknown>;
    goToPreviousStep(n?: number): Promise<unknown>;
    goToNextStep(): Promise<unknown>;
    goToLastVisitedStep(): Promise<unknown>;
  };
  subscriptions: {
    subscribeSelector(
      selector: (snapshot: unknown) => unknown,
      listener: (selected: unknown) => void
    ): () => void;
    subscribeEvent(
      event: JourneySubscriptionEvent,
      listener: (payload: unknown) => void
    ): () => void;
  };
  context: { update(updater: never): void };
  /** Present on graph machines only — its presence is the discriminant. */
  send?(type: never, payload?: never): Promise<unknown>;
};

/** Internal, generics-erased view of the machine the bridge operates on. */
export type LooseMachine = {
  getSnapshot(): unknown;
  controls: JourneyControls;
  navigate: {
    goToStepById(id: string): Promise<NavigationResult>;
    goToPreviousStep(n?: number): Promise<NavigationResult>;
    goToNextStep(): Promise<NavigationResult>;
    goToLastVisitedStep(): Promise<NavigationResult>;
  };
  subscriptions: {
    subscribeSelector(
      selector: (snapshot: unknown) => unknown,
      listener: (selected: unknown) => void
    ): () => void;
    subscribeEvent(
      event: JourneySubscriptionEvent,
      listener: (payload: Record<string, unknown>) => void
    ): () => void;
  };
  context: { update(updater: (previous: unknown) => unknown): void };
  send?(type: string, payload?: unknown): Promise<NavigationResult>;
};

/** One invokable operation: its wire descriptor plus the runner behind it. */
export type OperationRunner = {
  descriptor: {
    id: string;
    label: string;
    description: string | null;
    mutates: boolean;
    output: JourneyDevtoolsOperationResultPayload["kind"];
    fields: readonly {
      key: string;
      label: string;
      type: "text" | "integer" | "boolean" | "json";
      required?: boolean;
    }[];
  };
  run: (
    input: Record<string, unknown> | undefined
  ) => Promise<JourneyDevtoolsOperationResultPayload>;
};
