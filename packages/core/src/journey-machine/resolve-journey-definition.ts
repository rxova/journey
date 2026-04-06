import { validateFiniteTimeout } from "./helpers";

import type {
  JourneyDefinition,
  JourneyJsonObject,
  JourneyResolvedDefinition,
  JourneyResolvedTransition,
  JourneyTransition,
  JourneyTransitionGraph
} from "../types";

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
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>
>(
  transitions: readonly JourneyTransition<TContext, TStepId, TEventMap, THandlers>[]
): JourneyResolvedTransition<TContext, TStepId, TEventMap, THandlers>[] => {
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
    } as JourneyResolvedTransition<TContext, TStepId, TEventMap, THandlers>;
  });
};

export const resolveJourneyDefinition = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
>(
  journey: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>
): JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers> => {
  type TEventType = string;
  const resolvedTransitions: JourneyTransition<TContext, TStepId, TEventMap, THandlers>[] = [];
  const { transitions } = journey;

  if (transitions === undefined) {
    return {
      ...journey,
      transitions: buildResolvedTransitions(resolvedTransitions)
    } as JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
  }

  if (Array.isArray(transitions)) {
    if (transitions.length === 0) {
      throw new Error(
        "Journey linear transitions must include the initial step as the first item."
      );
    }

    const [initialStep, ...linearEntries] = transitions;
    if (typeof initialStep !== "string") {
      throw new Error("Journey linear transitions at index 0 must be a step id string.");
    }

    if (!(initialStep in journey.steps)) {
      throw new Error(`Journey linear transitions reference unknown step "${initialStep}".`);
    }

    // Resolve initial: use journey.initial if provided (start from middle), otherwise array[0]
    const resolvedInitial = (journey.initial ?? initialStep) as TStepId;

    if (journey.initial !== undefined) {
      const allStepIds = transitions.map((entry) =>
        typeof entry === "string" ? entry : entry.step
      );
      if (!allStepIds.includes(journey.initial)) {
        throw new Error(
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
          throw new Error(`Journey linear transitions reference unknown step "${entry}".`);
        }

        if (seenSteps.has(entry)) {
          throw new Error(
            `Journey linear transitions contain duplicate step "${entry}" at index ${index}.`
          );
        }
        seenSteps.add(entry);

        resolvedTransitions.push({
          from: previousStep,
          event: "goToNextStep" as TEventType,
          to: entry as TStepId
        } as JourneyTransition<TContext, TStepId, TEventMap, THandlers>);
        previousStep = entry as TStepId;
        continue;
      }

      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(
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
          throw new Error(
            `Journey linear transition object at index ${index} contains unsupported field "${key}". Allowed fields are "step", "label", "updateContext", "onEnter", "onLeave", and "timeoutMs".`
          );
        }
      }

      if (typeof entry.step !== "string") {
        throw new Error(
          `Journey linear transition object at index ${index} must define string "step".`
        );
      }

      if (!(entry.step in journey.steps)) {
        throw new Error(`Journey linear transitions reference unknown step "${entry.step}".`);
      }

      if (seenSteps.has(entry.step)) {
        throw new Error(
          `Journey linear transitions contain duplicate step "${entry.step}" at index ${index}.`
        );
      }
      seenSteps.add(entry.step);

      if (entry.updateContext !== undefined && typeof entry.updateContext !== "function") {
        throw new Error(
          `Journey linear transition object at index ${index} must define "updateContext" as a function when provided.`
        );
      }

      if (entry.onEnter !== undefined && typeof entry.onEnter !== "function") {
        throw new Error(
          `Journey linear transition object at index ${index} must define "onEnter" as a function when provided.`
        );
      }

      if (entry.onLeave !== undefined && typeof entry.onLeave !== "function") {
        throw new Error(
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
      } as JourneyTransition<TContext, TStepId, TEventMap, THandlers>);
      previousStep = entry.step as TStepId;
    }

    return {
      ...journey,
      initial: resolvedInitial,
      transitions: buildResolvedTransitions(resolvedTransitions)
    };
  }

  if (!transitions || typeof transitions !== "object") {
    throw new Error("Journey transitions must be an array or an object map when provided.");
  }

  const transitionGraph = transitions as JourneyTransitionGraph<
    TContext,
    TStepId,
    TEventMap,
    THandlers
  >;

  const orderedGraphEntries = [
    ...Object.entries(transitionGraph).filter(([fromKey]) => fromKey !== "global"),
    ...(transitionGraph.global ? ([["global", transitionGraph.global]] as const) : [])
  ];

  for (const [fromKey, eventMap] of orderedGraphEntries) {
    if (fromKey !== "global" && !(fromKey in journey.steps)) {
      throw new Error(`Journey transitions reference unknown step "${fromKey}".`);
    }

    if (!eventMap || typeof eventMap !== "object" || Array.isArray(eventMap)) {
      throw new Error(`Journey transitions for "${fromKey}" must be an event map object.`);
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
        throw new Error(`Journey transitions for "${fromKey}.${event}" must be an array.`);
      }

      for (const [index, edge] of edges.entries()) {
        if (!edge || typeof edge !== "object") {
          throw new Error(
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
            throw new Error(
              `Journey transition at "${fromKey}.${event}[${index}]" contains unsupported field "${key}".`
            );
          }
        }

        if (!isTerminal && typeof (edge as { to?: unknown }).to !== "string") {
          throw new Error(
            `Journey transition at "${fromKey}.${event}[${index}]" must define string "to".`
          );
        }

        if ((edge as { when?: unknown }).when !== undefined && typeof edge.when !== "function") {
          throw new Error(
            `Journey transition at "${fromKey}.${event}[${index}]" must define "when" as a function when provided.`
          );
        }

        if (
          (edge as { updateContext?: unknown }).updateContext !== undefined &&
          typeof edge.updateContext !== "function"
        ) {
          throw new Error(
            `Journey transition at "${fromKey}.${event}[${index}]" must define "updateContext" as a function when provided.`
          );
        }

        if (
          (edge as { onEnter?: unknown }).onEnter !== undefined &&
          typeof edge.onEnter !== "function"
        ) {
          throw new Error(
            `Journey transition at "${fromKey}.${event}[${index}]" must define "onEnter" as a function when provided.`
          );
        }

        if (
          (edge as { onLeave?: unknown }).onLeave !== undefined &&
          typeof edge.onLeave !== "function"
        ) {
          throw new Error(
            `Journey transition at "${fromKey}.${event}[${index}]" must define "onLeave" as a function when provided.`
          );
        }

        if ((edge as { label?: unknown }).label !== undefined && typeof edge.label !== "string") {
          throw new Error(
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
        } as JourneyTransition<TContext, TStepId, TEventMap, THandlers>);
      }
    }
  }

  return {
    ...journey,
    transitions: buildResolvedTransitions(resolvedTransitions)
  } as JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
};
