import { createGraphJourneyBuilder } from "@rxova/journey-core";
import type { AuthHandlers, EventMap, LoginContext, StepId, StepMeta } from "./types";

export const { createStep, to, build } = createGraphJourneyBuilder<{
  context: LoginContext;
  stepId: StepId;
  events: EventMap;
  meta: StepMeta;
  handlers: AuthHandlers;
}>();
