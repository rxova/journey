import { createGraphJourneyBuilder } from "@rxova/journey-core";
import type { EventMap, LoginContext, StepId, StepMeta } from "./types";

export const { createStep, to, build } = createGraphJourneyBuilder<
  LoginContext,
  StepId,
  EventMap,
  StepMeta
>();
