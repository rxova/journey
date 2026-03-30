import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = string;
type Ctx = { includeSurvey: boolean };

export const buildDynamicStepsJourney = (includeSurvey: boolean): JourneyDefinition<Ctx, StepId> =>
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
        transitions: {
          start: { goToNextStep: [{ to: "details" }] },
          details: { goToNextStep: [{ to: "survey" }] },
          survey: { goToNextStep: [{ to: "review" }] },
          review: { completeJourney: [{}] }
        }
      }
    : {
        initial: "start",
        context: { includeSurvey },
        steps: {
          start: {},
          details: {},
          review: {}
        },
        transitions: {
          start: { goToNextStep: [{ to: "details" }] },
          details: { goToNextStep: [{ to: "review" }] },
          review: { completeJourney: [{}] }
        }
      };

export const createDynamicStepsMachine = (includeSurvey: boolean) =>
  createJourneyMachine(buildDynamicStepsJourney(includeSurvey));
