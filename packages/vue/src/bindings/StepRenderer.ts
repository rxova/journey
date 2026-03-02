import { defineComponent, h, type VNodeChild } from "vue";

import type { JourneySnapshot, JourneyStepDefinition } from "@rxova/journey-core";
import type { JourneyStoreValue, JourneyVueEventPayloadMap } from "../types";

type UseJourneyStore<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = (
  hookName?: string
) => JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;

type UseJourneySnapshot<TContext, TStepId extends string, TStepMeta = unknown> = () => {
  value: JourneySnapshot<TContext, TStepId, TStepMeta>;
};

type StepRendererFactoryProps<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  useJourneySnapshot: UseJourneySnapshot<TContext, TStepId, TStepMeta>;
  useJourneyStore: UseJourneyStore<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;
};

export const createStepRenderer = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
>({
  useJourneySnapshot,
  useJourneyStore
}: StepRendererFactoryProps<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>) => {
  const StepRenderer = defineComponent({
    name: "JourneyStepRenderer",
    props: {
      fallback: {
        type: null,
        default: null
      }
    },
    setup(props) {
      const snapshot = useJourneySnapshot();
      const store = useJourneyStore("StepRenderer");

      return () => {
        const step = store.journey.steps[snapshot.value.currentStepId] as
          | (JourneyStepDefinition<TStepMeta> & { component?: unknown })
          | undefined;

        if (!step?.component) {
          return props.fallback as VNodeChild;
        }

        return h(step.component as never);
      };
    }
  });

  return StepRenderer;
};
