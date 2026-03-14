import { describe, expect, it } from "vitest";

import remarkTypescriptTabs from "../src/remark/remarkTypescriptTabs";

type Root = {
  type: "root";
  children: Array<{
    type: "code";
    lang: string;
    value: string;
  }>;
};

function getJavascriptValue(tree: Root): string {
  const tabs = tree.children[0] as unknown as {
    children: Array<{
      children: Array<{
        value: string;
      }>;
    }>;
  };

  return tabs.children[1].children[0].value;
}

describe("remarkTypescriptTabs", () => {
  it("preserves author formatting when the TypeScript snippet is already valid JavaScript", async () => {
    const source = `const journey = {
  transitions: ({ tx, createTransitions }) =>
    createTransitions(
      tx.from("start").on("goToNextStep").to("details", { id: "start-next" }),
      tx
        .from("details")
        .on("goToNextStep")
        .choose(({ when, otherwise }) => [
          when(({ context }) => context.canContinue).to("review", {
            id: "details-next-guarded"
          }),
          otherwise().to("review", {
            id: "details-save",
            effect: async ({ context }) => {
              const saved = await saveDraft(context);
              return { ...context, draftId: saved.id };
            }
          })
        ]),
      tx.any().toTerminate({ id: "cancel-anywhere" })
    )
};`;
    const tree: Root = {
      type: "root",
      children: [{ type: "code", lang: "ts", value: source }]
    };

    await remarkTypescriptTabs()(tree);

    expect(getJavascriptValue(tree)).toBe(source);
  });

  it("still transpiles snippets that contain TypeScript-only syntax", async () => {
    const source = `const saveDraft = async (input: { id: string }): Promise<string> => input.id;`;
    const tree: Root = {
      type: "root",
      children: [{ type: "code", lang: "ts", value: source }]
    };

    await remarkTypescriptTabs()(tree);

    expect(getJavascriptValue(tree)).toBe("const saveDraft = async (input) => input.id;");
  });

  it("formats transpiled tsx output with 2-space indentation", async () => {
    const source = `type Props = { isReady: boolean };

const App = ({ isReady }: Props) => {
  if (!isReady) return null;

  return (
    <Wizard>
      <Step1 />
      <Step2 />
      <Step3 />
    </Wizard>
  );
};`;
    const tree: Root = {
      type: "root",
      children: [{ type: "code", lang: "tsx", value: source }]
    };

    await remarkTypescriptTabs()(tree);

    expect(getJavascriptValue(tree)).toBe(`const App = ({ isReady }) => {
  if (!isReady) return null;
  return (
    <Wizard>
      <Step1 />
      <Step2 />
      <Step3 />
    </Wizard>
  );
};`);
  });

  it("preserves blank-line grouping when transpiling TypeScript-only declarations away", async () => {
    const source = `import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "details" | "review";
type Event = "goToNextStep" | "completeJourney" | "requestClose";
type Context = { name: string; dirty: boolean };
type PayloadMap = {
  requestClose: { source: "button" | "shortcut" };
};

const journey: JourneyDefinition<Context, StepId, Event, PayloadMap> = {
  initial: "start",
  context: { name: "", dirty: false },
  steps: {
    start: {},
    details: {},
    review: {}
  },
  transitions: ({ tx, createTransitions }) =>
    createTransitions(
      tx.from("start").on("goToNextStep").to("details"),
      tx.from("details").on("goToNextStep").to("review"),
      tx.from("review").toComplete()
    )
};

const machine = createJourneyMachine(journey);`;
    const tree: Root = {
      type: "root",
      children: [{ type: "code", lang: "ts", value: source }]
    };

    await remarkTypescriptTabs()(tree);

    expect(getJavascriptValue(tree))
      .toBe(`import { createJourneyMachine } from "@rxova/journey-core";

const journey = {
  initial: "start",
  context: { name: "", dirty: false },
  steps: {
    start: {},
    details: {},
    review: {},
  },
  transitions: ({ tx, createTransitions }) =>
    createTransitions(
      tx.from("start").on("goToNextStep").to("details"),
      tx.from("details").on("goToNextStep").to("review"),
      tx.from("review").toComplete(),
    ),
};

const machine = createJourneyMachine(journey);`);
  });
});
