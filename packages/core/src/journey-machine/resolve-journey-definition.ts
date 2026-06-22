import {
  JOURNEY_AFTER_EVENT_PREFIX,
  JOURNEY_EFFECT_REJECTED_EVENT,
  JOURNEY_EFFECT_RESOLVED_EVENT,
  validateFiniteTimeout,
  warnInDevelopment
} from "./helpers";
import { JourneyDefinitionError } from "./errors";

import type {
  JourneyBaseEvent,
  JourneyDefinition,
  JourneyJsonObject,
  JourneyResolvedDefinition,
  JourneyResolvedTransition,
  JourneyStepDefinition,
  JourneyTransition,
  JourneyTransitionGraph
} from "../types";
import type { JourneyEmpty } from "../types";

const hashTransitionDescriptor = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const buildResolvedTransitions = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>
>(
  transitions: readonly JourneyTransition<TContext, TStepId, TEvents, THandlers>[]
): JourneyResolvedTransition<TContext, TStepId, TEvents, THandlers>[] => {
  const transitionRouteCounts = new Map<string, number>();
  const usedIds = new Set<string>();

  return transitions.map((transition) => {
    const target =
      transition.event === "completeJourney"
        ? "COMPLETE"
        : transition.event === "terminateJourney"
          ? "TERMINATED"
          : String(transition.to);
    const routeKey = JSON.stringify({
      from: transition.from,
      event: transition.event,
      target
    });
    const ordinal = (transitionRouteCounts.get(routeKey) ?? 0) + 1;
    transitionRouteCounts.set(routeKey, ordinal);

    const descriptor = JSON.stringify({
      from: transition.from,
      event: transition.event,
      target,
      ordinal
    });

    let suffix = 0;
    const id = (() => {
      let candidate = hashTransitionDescriptor(descriptor);
      while (usedIds.has(candidate)) {
        suffix += 1;
        candidate = hashTransitionDescriptor(`${descriptor}:${suffix}`);
      }
      return candidate;
    })();
    usedIds.add(id);

    return {
      ...transition,
      id,
      ...(transition.label !== undefined ? { label: transition.label } : {})
    } as JourneyResolvedTransition<TContext, TStepId, TEvents, THandlers>;
  });
};

/**
 * Translates each step's declarative `effect` into the internal transitions the
 * runtime fires when the effect settles. The effect runner dispatches the
 * matching synthetic event with the resolved output (or rejection error) as the
 * payload; the wrapped `updateContext` exposes that payload as `output`/`error`.
 */
const buildEffectTransitions = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>
>(
  steps: Record<TStepId, JourneyStepDefinition<TContext, TStepId, TEvents, unknown, THandlers>>
): JourneyTransition<TContext, TStepId, TEvents, THandlers>[] => {
  const effectTransitions: JourneyTransition<TContext, TStepId, TEvents, THandlers>[] = [];

  for (const [stepId, step] of Object.entries(steps) as [
    TStepId,
    JourneyStepDefinition<TContext, TStepId, TEvents, unknown, THandlers>
  ][]) {
    const effect = step?.effect;
    if (!effect) {
      continue;
    }

    if (typeof effect.run !== "function") {
      throw new JourneyDefinitionError(
        "invalid-effect",
        `Journey step "${stepId}" effect must define "run" as a function.`
      );
    }
    validateFiniteTimeout(effect.timeoutMs, `Journey step "${stepId}" effect`);

    if (effect.onResolved) {
      const branch = effect.onResolved;
      if (branch.to === stepId) {
        throw new JourneyDefinitionError(
          "self-transition",
          `Journey step "${stepId}" effect "onResolved" cannot target its own step "${stepId}".`
        );
      }
      effectTransitions.push({
        from: stepId,
        event: JOURNEY_EFFECT_RESOLVED_EVENT,
        to: branch.to,
        ...(branch.label !== undefined ? { label: branch.label } : {}),
        ...(branch.updateContext !== undefined
          ? {
              updateContext: (args: {
                snapshot: unknown;
                context: TContext;
                from: TStepId;
                event: { payload?: unknown };
              }) =>
                branch.updateContext!({
                  snapshot: args.snapshot as never,
                  context: args.context,
                  from: args.from,
                  output: args.event.payload as never
                })
            }
          : {})
      } as unknown as JourneyTransition<TContext, TStepId, TEvents, THandlers>);
    }

    if (effect.onRejected) {
      const branch = effect.onRejected;
      if (branch.to === stepId) {
        throw new JourneyDefinitionError(
          "self-transition",
          `Journey step "${stepId}" effect "onRejected" cannot target its own step "${stepId}".`
        );
      }
      effectTransitions.push({
        from: stepId,
        event: JOURNEY_EFFECT_REJECTED_EVENT,
        to: branch.to,
        ...(branch.label !== undefined ? { label: branch.label } : {}),
        ...(branch.updateContext !== undefined
          ? {
              updateContext: (args: {
                snapshot: unknown;
                context: TContext;
                from: TStepId;
                event: { payload?: unknown };
              }) =>
                branch.updateContext!({
                  snapshot: args.snapshot as never,
                  context: args.context,
                  from: args.from,
                  error: args.event.payload
                })
            }
          : {})
      } as unknown as JourneyTransition<TContext, TStepId, TEvents, THandlers>);
    }
  }

  return effectTransitions;
};

/**
 * Translates each step's `after` map into the internal transitions the runtime
 * fires when a delay timer elapses. The timer runner dispatches the matching
 * synthetic event (suffixed with the delay) for the active step.
 */
const buildAfterTransitions = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>
>(
  steps: Record<TStepId, JourneyStepDefinition<TContext, TStepId, TEvents, unknown, THandlers>>
): JourneyTransition<TContext, TStepId, TEvents, THandlers>[] => {
  const afterTransitions: JourneyTransition<TContext, TStepId, TEvents, THandlers>[] = [];

  for (const [stepId, step] of Object.entries(steps) as [
    TStepId,
    JourneyStepDefinition<TContext, TStepId, TEvents, unknown, THandlers>
  ][]) {
    const after = step?.after;
    if (!after) {
      continue;
    }

    for (const [delayKey, branch] of Object.entries(after)) {
      const delayMs = Number(delayKey);
      if (!Number.isFinite(delayMs) || delayMs < 0) {
        throw new JourneyDefinitionError(
          "invalid-after",
          `Journey step "${stepId}" after delay "${delayKey}" must be a finite, non-negative number of milliseconds.`
        );
      }

      if (branch.to === stepId) {
        throw new JourneyDefinitionError(
          "self-transition",
          `Journey step "${stepId}" after delay "${delayKey}" cannot target its own step "${stepId}".`
        );
      }

      afterTransitions.push({
        from: stepId,
        event: `${JOURNEY_AFTER_EVENT_PREFIX}${delayMs}`,
        to: branch.to,
        ...(branch.label !== undefined ? { label: branch.label } : {}),
        ...(branch.updateContext !== undefined
          ? {
              updateContext: (args: { snapshot: unknown; context: TContext; from: TStepId }) =>
                branch.updateContext!({
                  snapshot: args.snapshot as never,
                  context: args.context,
                  from: args.from
                })
            }
          : {})
      } as unknown as JourneyTransition<TContext, TStepId, TEvents, THandlers>);
    }
  }

  return afterTransitions;
};

export const resolveJourneyDefinition = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
>(
  journey: JourneyDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>
): JourneyResolvedDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers> => {
  type TEventType = string;
  const resolvedTransitions: JourneyTransition<TContext, TStepId, TEvents, THandlers>[] = [];
  const effectTransitions = [
    ...buildEffectTransitions(journey.steps),
    ...buildAfterTransitions(journey.steps)
  ];
  const { transitions } = journey;

  if (transitions === undefined) {
    if (effectTransitions.length > 0) {
      warnInDevelopment(
        "Journey step effects and after-transitions require graph or linear transitions and are ignored in headless mode."
      );
    }
    return {
      ...journey,
      transitions: buildResolvedTransitions(resolvedTransitions)
    } as JourneyResolvedDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>;
  }

  if (Array.isArray(transitions)) {
    if (transitions.length === 0) {
      throw new JourneyDefinitionError(
        "invalid-shape",
        "Journey linear transitions must include the initial step as the first item."
      );
    }

    const [initialStep, ...linearEntries] = transitions;
    if (typeof initialStep !== "string") {
      throw new JourneyDefinitionError(
        "invalid-shape",
        "Journey linear transitions at index 0 must be a step id string."
      );
    }

    if (!(initialStep in journey.steps)) {
      throw new JourneyDefinitionError(
        "unknown-step",
        `Journey linear transitions reference unknown step "${initialStep}".`
      );
    }

    // Resolve initial: use journey.initial if provided (start from middle), otherwise array[0]
    const resolvedInitial = (journey.initial ?? initialStep) as TStepId;

    if (journey.initial !== undefined) {
      const allStepIds = transitions.map((entry) =>
        typeof entry === "string" ? entry : entry.step
      );
      if (!allStepIds.includes(journey.initial)) {
        throw new JourneyDefinitionError(
          "unknown-step",
          `Journey initial step "${journey.initial}" does not exist in linear transitions.`
        );
      }
    }

    let previousStep = initialStep as TStepId;
    const seenSteps = new Set<string>([initialStep]);
    for (const [offset, entry] of linearEntries.entries()) {
      const index = offset + 1;
      if (typeof entry === "string") {
        if (!(entry in journey.steps)) {
          throw new JourneyDefinitionError(
            "unknown-step",
            `Journey linear transitions reference unknown step "${entry}".`
          );
        }

        if (seenSteps.has(entry)) {
          throw new JourneyDefinitionError(
            "duplicate-step",
            `Journey linear transitions contain duplicate step "${entry}" at index ${index}.`
          );
        }
        seenSteps.add(entry);

        resolvedTransitions.push({
          from: previousStep,
          event: "goToNextStep" as TEventType,
          to: entry as TStepId
        } as JourneyTransition<TContext, TStepId, TEvents, THandlers>);
        previousStep = entry as TStepId;
        continue;
      }

      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new JourneyDefinitionError(
          "invalid-shape",
          `Journey linear transitions at index ${index} must be a step id string or step config object.`
        );
      }

      const allowedKeys = new Set([
        "step",
        "label",
        "updateContext",
        "onEnter",
        "onLeave",
        "timeoutMs"
      ]);
      for (const key of Object.keys(entry)) {
        if (!allowedKeys.has(key)) {
          throw new JourneyDefinitionError(
            "invalid-transition",
            `Journey linear transition object at index ${index} contains unsupported field "${key}". Allowed fields are "step", "label", "updateContext", "onEnter", "onLeave", and "timeoutMs".`
          );
        }
      }

      if (typeof entry.step !== "string") {
        throw new JourneyDefinitionError(
          "invalid-transition",
          `Journey linear transition object at index ${index} must define string "step".`
        );
      }

      if (!(entry.step in journey.steps)) {
        throw new JourneyDefinitionError(
          "unknown-step",
          `Journey linear transitions reference unknown step "${entry.step}".`
        );
      }

      if (seenSteps.has(entry.step)) {
        throw new JourneyDefinitionError(
          "duplicate-step",
          `Journey linear transitions contain duplicate step "${entry.step}" at index ${index}.`
        );
      }
      seenSteps.add(entry.step);

      if (entry.updateContext !== undefined && typeof entry.updateContext !== "function") {
        throw new JourneyDefinitionError(
          "invalid-transition",
          `Journey linear transition object at index ${index} must define "updateContext" as a function when provided.`
        );
      }

      if (entry.onEnter !== undefined && typeof entry.onEnter !== "function") {
        throw new JourneyDefinitionError(
          "invalid-transition",
          `Journey linear transition object at index ${index} must define "onEnter" as a function when provided.`
        );
      }

      if (entry.onLeave !== undefined && typeof entry.onLeave !== "function") {
        throw new JourneyDefinitionError(
          "invalid-transition",
          `Journey linear transition object at index ${index} must define "onLeave" as a function when provided.`
        );
      }

      validateFiniteTimeout(entry.timeoutMs, `Journey linear transition object at index ${index}`);

      resolvedTransitions.push({
        ...(entry.label !== undefined ? { label: entry.label } : {}),
        ...(entry.timeoutMs !== undefined ? { timeoutMs: entry.timeoutMs } : {}),
        ...(entry.updateContext !== undefined ? { updateContext: entry.updateContext } : {}),
        ...(entry.onEnter !== undefined ? { onEnter: entry.onEnter } : {}),
        ...(entry.onLeave !== undefined ? { onLeave: entry.onLeave } : {}),
        from: previousStep,
        event: "goToNextStep" as TEventType,
        to: entry.step as TStepId
      } as JourneyTransition<TContext, TStepId, TEvents, THandlers>);
      previousStep = entry.step as TStepId;
    }

    return {
      ...journey,
      initial: resolvedInitial,
      transitions: buildResolvedTransitions([...resolvedTransitions, ...effectTransitions])
    };
  }

  if (!transitions || typeof transitions !== "object") {
    throw new JourneyDefinitionError(
      "invalid-shape",
      "Journey transitions must be an array or an object map when provided."
    );
  }

  const transitionGraph = transitions as JourneyTransitionGraph<
    TContext,
    TStepId,
    TEvents,
    THandlers
  >;

  const orderedGraphEntries = [
    ...Object.entries(transitionGraph).filter(([fromKey]) => fromKey !== "global"),
    ...(transitionGraph.global ? ([["global", transitionGraph.global]] as const) : [])
  ];

  for (const [fromKey, eventMap] of orderedGraphEntries) {
    if (fromKey !== "global" && !(fromKey in journey.steps)) {
      throw new JourneyDefinitionError(
        "unknown-step",
        `Journey transitions reference unknown step "${fromKey}".`
      );
    }

    if (!eventMap || typeof eventMap !== "object" || Array.isArray(eventMap)) {
      throw new JourneyDefinitionError(
        "invalid-shape",
        `Journey transitions for "${fromKey}" must be an event map object.`
      );
    }

    for (const [event, rawEdges] of Object.entries(eventMap) as Array<
      [TEventType, (typeof eventMap)[TEventType] | true]
    >) {
      const isTerminal = event === "completeJourney" || event === "terminateJourney";
      const edges =
        isTerminal && (rawEdges === true || (Array.isArray(rawEdges) && rawEdges.length === 0))
          ? [{}]
          : rawEdges;

      if (!Array.isArray(edges)) {
        throw new JourneyDefinitionError(
          "invalid-shape",
          `Journey transitions for "${fromKey}.${event}" must be an array.`
        );
      }

      for (const [index, edge] of edges.entries()) {
        if (!edge || typeof edge !== "object") {
          throw new JourneyDefinitionError(
            "invalid-shape",
            `Journey transition at "${fromKey}.${event}[${index}]" must be an object.`
          );
        }

        const allowedKeys = new Set(
          isTerminal
            ? ["when", "updateContext", "onEnter", "onLeave", "label", "timeoutMs"]
            : ["to", "when", "updateContext", "onEnter", "onLeave", "label", "timeoutMs"]
        );
        for (const key of Object.keys(edge)) {
          if (!allowedKeys.has(key)) {
            throw new JourneyDefinitionError(
              "invalid-transition",
              `Journey transition at "${fromKey}.${event}[${index}]" contains unsupported field "${key}".`
            );
          }
        }

        if (!isTerminal && typeof (edge as { to?: unknown }).to !== "string") {
          throw new JourneyDefinitionError(
            "invalid-transition",
            `Journey transition at "${fromKey}.${event}[${index}]" must define string "to".`
          );
        }

        if (!isTerminal && fromKey !== "global" && (edge as { to?: unknown }).to === fromKey) {
          throw new JourneyDefinitionError(
            "self-transition",
            `Journey transition "${fromKey}.${event}[${index}]" cannot target its own step "${fromKey}".`
          );
        }

        if ((edge as { when?: unknown }).when !== undefined && typeof edge.when !== "function") {
          throw new JourneyDefinitionError(
            "invalid-transition",
            `Journey transition at "${fromKey}.${event}[${index}]" must define "when" as a function when provided.`
          );
        }

        if (
          (edge as { updateContext?: unknown }).updateContext !== undefined &&
          typeof edge.updateContext !== "function"
        ) {
          throw new JourneyDefinitionError(
            "invalid-transition",
            `Journey transition at "${fromKey}.${event}[${index}]" must define "updateContext" as a function when provided.`
          );
        }

        if (
          (edge as { onEnter?: unknown }).onEnter !== undefined &&
          typeof edge.onEnter !== "function"
        ) {
          throw new JourneyDefinitionError(
            "invalid-transition",
            `Journey transition at "${fromKey}.${event}[${index}]" must define "onEnter" as a function when provided.`
          );
        }

        if (
          (edge as { onLeave?: unknown }).onLeave !== undefined &&
          typeof edge.onLeave !== "function"
        ) {
          throw new JourneyDefinitionError(
            "invalid-transition",
            `Journey transition at "${fromKey}.${event}[${index}]" must define "onLeave" as a function when provided.`
          );
        }

        if ((edge as { label?: unknown }).label !== undefined && typeof edge.label !== "string") {
          throw new JourneyDefinitionError(
            "invalid-transition",
            `Journey transition at "${fromKey}.${event}[${index}]" must define "label" as a string when provided.`
          );
        }

        validateFiniteTimeout(
          (edge as { timeoutMs?: unknown }).timeoutMs,
          `Journey transition at "${fromKey}.${event}[${index}]"`
        );

        resolvedTransitions.push({
          ...edge,
          from: (fromKey === "global" ? "*" : fromKey) as TStepId | "*",
          event
        } as JourneyTransition<TContext, TStepId, TEvents, THandlers>);
      }
    }
  }

  return {
    ...journey,
    transitions: buildResolvedTransitions([...resolvedTransitions, ...effectTransitions])
  } as JourneyResolvedDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>;
};
