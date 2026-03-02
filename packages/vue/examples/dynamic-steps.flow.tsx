import { computed, defineComponent, ref } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = string;
type Ctx = { includeSurvey: boolean };

const Start = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Start</button>`
});

const Details = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Continue</button>`
});

const Survey = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Finish survey</button>`
});

const Review = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.completeJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Submit</button>`
});

const buildJourney = (includeSurvey: boolean): JourneyVueDefinition<Ctx, StepId> => ({
  initial: "start",
  context: { includeSurvey },
  steps: includeSurvey
    ? {
        start: { component: Start },
        details: { component: Details },
        survey: { component: Survey },
        review: { component: Review }
      }
    : {
        start: { component: Start },
        details: { component: Details },
        review: { component: Review }
      },
  transitions: includeSurvey
    ? [
        { from: "start", event: "goToNextStep", to: "details" },
        { from: "details", event: "goToNextStep", to: "survey" },
        { from: "survey", event: "goToNextStep", to: "review" },
        { from: "review", event: "completeJourney" }
      ]
    : [
        { from: "start", event: "goToNextStep", to: "details" },
        { from: "details", event: "goToNextStep", to: "review" },
        { from: "review", event: "completeJourney" }
      ]
});

const bindings = createJourneyBindings(buildJourney(false));

export const DynamicStepsExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  setup() {
    const includeSurvey = ref(false);
    const journey = computed(() => buildJourney(includeSurvey.value));
    const toggleSurvey = () => {
      includeSurvey.value = !includeSurvey.value;
    };
    return { includeSurvey, journey, toggleSurvey };
  },
  template:
    `<div>` +
    `<button @click="toggleSurvey">{{ includeSurvey ? "Remove survey step" : "Add survey step" }}</button>` +
    `<p>Dynamic step is {{ includeSurvey ? "enabled" : "disabled" }}. Toggling rebuilds the journey graph; if you want a reset, pass resetOnJourneyChange or remount the provider.</p>` +
    `<Provider :journey="journey"><StepRenderer /></Provider>` +
    `</div>`
});
