import { createApp, defineComponent, h, onBeforeUnmount, onMounted } from "vue";

import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import {
  JOURNEY_STATUS,
  createJourneyBindings,
  type JourneyBindings,
  type JourneyVueDefinition
} from "@rxova/journey-vue";

type VueStepId = "start" | "details" | "review" | "confirmExit";
type VueContext = {
  name: string;
  includeDetails: boolean;
  dirty: boolean;
};
type VueEvent = "requestClose";

let vueBindings: JourneyBindings<VueContext, VueStepId, VueEvent>;

const useVueJourneyApi = () => vueBindings.useJourneyApi();
const useVueJourneySnapshot = () => vueBindings.useJourneySnapshot();
const useVueJourneyMachine = () => vueBindings.useJourneyMachine();

const BridgeConnector = defineComponent(() => {
  const machine = useVueJourneyMachine();

  let detach: (() => void) | undefined;

  onMounted(() => {
    detach = attachJourneyDevtools(machine, {
      machineId: "vue-flow",
      label: "Vue Flow",
      appName: "Journey Demo",
      enabled: true,
      commandsEnabled: true
    });
  });

  onBeforeUnmount(() => {
    detach?.();
  });

  return () => null;
});

const StartStep = defineComponent(() => {
  const snapshot = useVueJourneySnapshot();
  const api = useVueJourneyApi();

  return () =>
    h("div", { class: "step" }, [
      h("h3", "Start"),
      h("label", { class: "field" }, [
        "Name",
        h("input", {
          value: snapshot.value.context.name,
          placeholder: "Grace Hopper",
          onInput: (event: Event) => {
            const target = event.target as HTMLInputElement;
            api.updateContext((context) => ({
              ...context,
              name: target.value,
              dirty: true
            }));
          }
        })
      ]),
      h("label", { class: "field checkbox" }, [
        h("input", {
          type: "checkbox",
          checked: snapshot.value.context.includeDetails,
          onChange: (event: Event) => {
            const target = event.target as HTMLInputElement;
            api.updateContext((context) => ({
              ...context,
              includeDetails: target.checked,
              dirty: true
            }));
          }
        }),
        "Visit details step"
      ]),
      h("div", { class: "actions" }, [
        h(
          "button",
          {
            onClick: () => void api.goToNextStep()
          },
          "Next"
        ),
        h(
          "button",
          {
            class: "secondary",
            onClick: () =>
              void (snapshot.value.context.dirty
                ? api.send({ type: "requestClose" })
                : api.terminateJourney())
          },
          "Close"
        )
      ])
    ]);
});

const DetailsStep = defineComponent(() => {
  const api = useVueJourneyApi();

  return () =>
    h("div", { class: "step" }, [
      h("h3", "Details"),
      h("p", "Example intermediate step to verify transitions and timeline behavior."),
      h("div", { class: "actions" }, [
        h(
          "button",
          {
            class: "secondary",
            onClick: () => void api.goToPreviousStep()
          },
          "Go to previous step"
        ),
        h(
          "button",
          {
            onClick: () => void api.goToNextStep()
          },
          "Next"
        )
      ])
    ]);
});

const ReviewStep = defineComponent(() => {
  const snapshot = useVueJourneySnapshot();
  const api = useVueJourneyApi();

  return () =>
    h("div", { class: "step" }, [
      h("h3", "Review"),
      h("p", [
        "Ready to submit for ",
        h("strong", snapshot.value.context.name || "Anonymous"),
        "?"
      ]),
      h("div", { class: "actions" }, [
        h(
          "button",
          {
            class: "secondary",
            onClick: () => void api.goToPreviousStep()
          },
          "Go to previous step"
        ),
        h(
          "button",
          {
            class: "secondary",
            onClick: () =>
              void (snapshot.value.context.dirty
                ? api.send({ type: "requestClose" })
                : api.terminateJourney())
          },
          "Close"
        ),
        h(
          "button",
          {
            onClick: () => void api.completeJourney()
          },
          "Submit"
        )
      ])
    ]);
});

const ConfirmExitStep = defineComponent(() => {
  const api = useVueJourneyApi();

  return () =>
    h("div", { class: "step" }, [
      h("h3", "Confirm Exit"),
      h("p", "You have unsaved changes. Confirm close?"),
      h("div", { class: "actions" }, [
        h(
          "button",
          {
            class: "secondary",
            onClick: () => void api.goToPreviousStep()
          },
          "Keep editing"
        ),
        h(
          "button",
          {
            onClick: () => void api.terminateJourney()
          },
          "Confirm close"
        )
      ])
    ]);
});

const vueJourney: JourneyVueDefinition<VueContext, VueStepId, VueEvent> = {
  initial: "start",
  context: {
    name: "",
    includeDetails: true,
    dirty: false
  },
  steps: {
    start: { component: StartStep, meta: { label: "Start" } },
    details: { component: DetailsStep, meta: { label: "Details" } },
    review: { component: ReviewStep, meta: { label: "Review" } },
    confirmExit: { component: ConfirmExitStep, meta: { label: "Confirm Exit" } }
  },
  transitions: [
    {
      from: "start",
      event: "goToNextStep",
      to: "details",
      when: ({ context }) => context.includeDetails
    },
    {
      from: "start",
      event: "goToNextStep",
      to: "review",
      when: ({ context }) => !context.includeDetails
    },
    { from: "details", event: "goToNextStep", to: "review" },
    {
      from: "*",
      event: "requestClose",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    { from: "*", event: "terminateJourney" },
    { from: "review", event: "completeJourney" }
  ]
};

vueBindings = createJourneyBindings(vueJourney);

const VueMachinePanel = defineComponent(() => {
  const snapshot = useVueJourneySnapshot();
  const api = useVueJourneyApi();
  const StepRenderer = vueBindings.StepRenderer;

  return () =>
    h("section", { class: "card" }, [
      h("div", { class: "card-head" }, [
        h("h2", "Vue Machine"),
        h("span", { class: `status status-${snapshot.value.status}` }, snapshot.value.status)
      ]),
      h("p", { class: "hint" }, [
        "Powered by ",
        h("code", "@rxova/journey-vue"),
        " and bridged as ",
        h("code", "vue-flow"),
        "."
      ]),
      h(StepRenderer, {
        fallback: h("p", "Missing step component.")
      }),
      h("div", { class: "actions card-actions" }, [
        h(
          "button",
          {
            class: "secondary",
            onClick: () => api.resetJourney()
          },
          "Reset"
        ),
        h(
          "button",
          {
            class: "secondary",
            onClick: () => void api.goToLastVisitedStep()
          },
          "Go to last visited step"
        )
      ]),
      h("pre", { class: "snapshot" }, JSON.stringify(snapshot.value, null, 2)),
      h("div", { class: "hint footer-note" }, [
        "Vue status values: ",
        h("code", JOURNEY_STATUS.RUNNING),
        ", ",
        h("code", JOURNEY_STATUS.COMPLETE),
        ", ",
        h("code", JOURNEY_STATUS.TERMINATED)
      ])
    ]);
});

const Root = defineComponent(() => {
  const Provider = vueBindings.Provider;

  return () =>
    h(Provider, null, {
      default: () => [h(BridgeConnector), h(VueMachinePanel)]
    });
});

export const mountVueMachinePanel = (container: Element) => {
  const app = createApp(Root);
  app.mount(container);

  return () => {
    app.unmount();
  };
};
