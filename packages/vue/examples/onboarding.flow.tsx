import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "welcome" | "profile" | "teamInvite" | "recap";
type Ctx = {
  inviteTeam: boolean;
  dirty: boolean;
};

const Welcome = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Start onboarding</button>`
});

const Profile = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Save profile</button>`
});

const TeamInvite = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Skip invite</button>`
});

const Recap = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.completeJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Finish</button>`
});

export const onboardingJourney: JourneyVueDefinition<Ctx, StepId, never> = {
  initial: "welcome",
  context: {
    inviteTeam: false,
    dirty: false
  },
  steps: {
    welcome: { component: Welcome },
    profile: { component: Profile },
    teamInvite: { component: TeamInvite },
    recap: { component: Recap }
  },
  transitions: [
    { from: "welcome", event: "goToNextStep", to: "profile" },
    {
      from: "profile",
      event: "goToNextStep",
      to: "teamInvite",
      when: ({ context }) => context.inviteTeam
    },
    {
      from: "profile",
      event: "goToNextStep",
      to: "recap",
      when: ({ context }) => !context.inviteTeam
    },
    { from: "teamInvite", event: "goToNextStep", to: "recap" },
    { from: "recap", event: "completeJourney" },
    { from: "*", event: "terminateJourney" }
  ]
};

const bindings = createJourneyBindings(onboardingJourney);

export const OnboardingExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
