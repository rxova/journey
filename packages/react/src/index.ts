// Mark this entry point as a Next.js App Router client module so it can be used in client components.
"use client";

export { createJourneyBindings } from "./bindings";
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
