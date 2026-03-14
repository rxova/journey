// Mark this entry point as a Next.js App Router client module so it can be used in client components.
"use client";

export { createJourneyBindings } from "./bindings";
export {
  JOURNEY_STATUS,
  JOURNEY_EVENT,
  JOURNEY_ASYNC_PHASE,
  JOURNEY_WILDCARD
} from "@rxova/journey-core";
export type { JourneyDefinition, JourneySendResult } from "@rxova/journey-core";
export type {
  JourneyApi,
  JourneyBindings,
  JourneyBindingsProviderProps,
  JourneyEventType,
  JourneyReactDefinition,
  JourneyReactEventPayloadMap,
  JourneyReactStep,
  JourneyStoreValue
} from "./types";
