/* eslint-disable no-redeclare */
import { resolveTransitionTarget } from "../../journey-machine/helpers";
import { resolveJourneyDefinition } from "../../journey-machine/resolve-journey-definition";

import type {
  JourneyDefinition,
  JourneyExecutionPath,
  JourneyExecutionPathEventType,
  JourneyExecutionPathOptions,
  JourneyExecutionPathsResult,
  JourneyFullEventType,
  JourneyJsonObject,
  JourneyResolvedDefinition
} from "../../types";

const normalizeLimit = (value: number | undefined, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(value));
};

/**
 * Enumerates structural execution paths from a resolved journey definition.
 */
export function getExecutionPaths<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
>(
  journey: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyExecutionPathOptions
): JourneyExecutionPathsResult<TStepId, JourneyFullEventType<TEventMap>>;
export function getExecutionPaths<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
>(
  journey: JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyExecutionPathOptions
): JourneyExecutionPathsResult<TStepId, JourneyFullEventType<TEventMap>>;
export function getExecutionPaths<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
>(
  journey:
    | JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>
    | JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options: JourneyExecutionPathOptions = {}
): JourneyExecutionPathsResult<TStepId, JourneyFullEventType<TEventMap>> {
  type TEventType = JourneyFullEventType<TEventMap>;
  const isResolvedJourneyDefinition = (
    value: typeof journey
  ): value is JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers> =>
    Array.isArray(value.transitions) &&
    (value.transitions.length === 0 ||
      (typeof value.transitions[0] === "object" && value.transitions[0] !== null));
  const resolvedJourney = isResolvedJourneyDefinition(journey)
    ? journey
    : resolveJourneyDefinition(journey);
  const maxDepth = normalizeLimit(options.maxDepth, 5);
  const maxPaths = normalizeLimit(options.maxPaths, 10);
  const paths: JourneyExecutionPath<TStepId, TEventType>[] = [];
  let truncated = false;
  let cyclesDetected = false;

  const pushPath = (path: JourneyExecutionPath<TStepId, TEventType>) => {
    if (paths.length >= maxPaths) {
      truncated = true;
      return;
    }

    paths.push(path);
  };

  const visit = (
    currentStepId: TStepId,
    steps: TStepId[],
    events: JourneyExecutionPathEventType<TEventType>[]
  ) => {
    if (paths.length >= maxPaths) {
      truncated = true;
      return;
    }

    const outgoing = resolvedJourney.transitions.filter(
      (transition) => transition.from === "*" || transition.from === currentStepId
    );

    if (outgoing.length === 0) {
      pushPath({ steps, events, terminated: "final" });
      return;
    }

    if (events.length >= maxDepth) {
      pushPath({ steps, events, terminated: "depth" });
      truncated = true;
      return;
    }

    for (const transition of outgoing) {
      const nextEvents = [...events, transition.event as JourneyExecutionPathEventType<TEventType>];
      const target = resolveTransitionTarget(transition);

      if (target === "COMPLETE" || target === "TERMINATED") {
        pushPath({ steps, events: nextEvents, terminated: "final" });
        continue;
      }

      const nextSteps = [...steps, target];
      if (steps.includes(target)) {
        cyclesDetected = true;
        pushPath({ steps: nextSteps, events: nextEvents, terminated: "cycle" });
        continue;
      }

      visit(target, nextSteps, nextEvents);
      if (paths.length >= maxPaths) {
        truncated = true;
        return;
      }
    }
  };

  visit(resolvedJourney.initial, [resolvedJourney.initial], []);

  return {
    paths,
    truncated,
    cyclesDetected
  };
}
/* eslint-enable no-redeclare */
