import {
  createJourneyMachine,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = string;
type Event = "next" | "submit";
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
          { from: "start", event: "next", to: "details" },
          { from: "details", event: "next", to: "survey" },
          { from: "survey", event: "next", to: "review" },
          { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
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
          { from: "start", event: "next", to: "details" },
          { from: "details", event: "next", to: "review" },
          { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
        ]
      };

export const createDynamicStepsMachine = (includeSurvey: boolean) =>
  createJourneyMachine<Ctx, StepId, Event>(buildDynamicStepsJourney(includeSurvey));
