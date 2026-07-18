/** Type-level assertions for the optional Immer connector. */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { immerConnector } from "@rxova/journey-core/connectors/immer";
import type { ContextUpdater } from "@rxova/journey-core";

type Context = {
  readonly account: {
    readonly name: string;
    readonly tags: readonly string[];
  };
};

const mutateReadonlyContext: ContextUpdater<Context> = immerConnector<Context>((draft) => {
  draft.account.name = "Grace";
  draft.account.tags.push("admin");
});

const replaceContext: ContextUpdater<Context> = immerConnector<Context>(() => ({
  account: { name: "Lin", tags: ["owner"] }
}));

immerConnector<Context>((draft) => {
  // @ts-expect-error draft fields retain their declared value types
  draft.account.name = 42;
});

// @ts-expect-error replacement contexts must match the declared context
immerConnector<Context>(() => {
  return { account: { name: 42, tags: [] } };
});

// @ts-expect-error context updates and Immer recipes are synchronous
immerConnector<Context>(async (draft) => {
  draft.account.name = "Async";
});
