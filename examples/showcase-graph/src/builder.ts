import { createJourneyBuilder } from "@rxova/journey-core";
import type { EventMap, LoginContext, StepId, StepMeta } from "./types";

export const { createStep, to, build } = createJourneyBuilder<
  LoginContext,
  StepId,
  EventMap,
  StepMeta
>();
