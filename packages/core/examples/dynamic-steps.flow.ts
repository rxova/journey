import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = string;
type Event = "goToNextStep" | "completeJourney";
type Ctx = { includeSurvey: boolean };

export const buildDynamicStepsJourney = (
  includeSurvey: boolean
): JourneyDefinition<Ctx, StepId, Event> =>
  includeSurvey
    ? {
        initial: "start",
        context: { includeSurvey },
        steps: {
          start: {},
          details: {},
          survey: {},
          review: {}
        },
        transitions: [
          { from: "start", event: "goToNextStep", to: "details" },
          { from: "details", event: "goToNextStep", to: "survey" },
          { from: "survey", event: "goToNextStep", to: "review" },
          { from: "review", event: "completeJourney" }
        ]
      }
    : {
        initial: "start",
        context: { includeSurvey },
        steps: {
          start: {},
          details: {},
          review: {}
        },
        transitions: [
          { from: "start", event: "goToNextStep", to: "details" },
          { from: "details", event: "goToNextStep", to: "review" },
          { from: "review", event: "completeJourney" }
        ]
      };

export const createDynamicStepsMachine = (includeSurvey: boolean) =>
  createJourneyMachine<Ctx, StepId, Event>(buildDynamicStepsJourney(includeSurvey));
