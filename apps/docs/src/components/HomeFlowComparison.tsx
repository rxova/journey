import type { ReactNode } from "react";
import CodeBlock from "@theme/CodeBlock";
import styles from "./HomeFlowComparison.module.css";

const INDEX_SNIPPET = `const [step, setStep] = useState(0);

// everything past "next" is hand-rolled:
// - branch to a different step on a condition
// - go back along the real path, not step - 1
// - await validation before the move commits
// - report where the user actually is
// - restore the flow after a refresh`;

/**
 * Verified against `packages/react/src` by compiling this exact snippet with
 * `tsc` — not lifted from prose docs.
 *
 * The factory is the typing story: `createLinearJourney` infers the context
 * type from `definition.context` (the annotated variable) and the step-id
 * union from the steps tuple (`create-linear-journey.tsx`), so the hooks and
 * the Provider's `views` record are fully typed with no generics at call
 * sites — a missing or typo'd view key is a compile error
 * (`LinearJourneyViews` in `linear.types.ts` maps every declared id). The
 * factory owns one standalone machine: hooks, `navigate`, and
 * `updateContext` close over it and work with or without the Provider.
 *
 * Why the submit lives in `signup.useStepHandler` and not in the completion
 * observer: `statusChange` fires after the status is already committed, and
 * core's emit is synchronous and drops listener results. The awaited gate is
 * `NavigationWork.run`, reached via `useStepHandler` — a shell over
 * `registerNextStepInterceptor` whose rejection cancels the move and lands
 * in `currentStep.async.error`, with `machine.isLoading` true meanwhile.
 *
 * The work is attached to `review`, which has a successor on purpose:
 * `goToNextStep` returns `out-of-bounds` at the last declared step *before*
 * running any work, so a gate registered on the final step would never fire.
 */
const JOURNEY_SNIPPET = `import { createLinearJourney } from "@rxova/journey-react";

type SignupContext = { email: string; orderId: string | null };
const initialContext: SignupContext = { email: "", orderId: null };

// The typed factory: context and step ids are inferred once, here, and the
// bundle owns one standalone machine.
const signup = createLinearJourney({
  name: "signup",
  context: initialContext,
  steps: ["email", "review", "done"]
});

// Observer only (the status is already committed): no React required.
signup.machine.subscriptions.subscribeEvent("statusChange", ({ current, snapshot }) => {
  if (current === "completed") analytics.track("signup_complete", snapshot.context);
});

function EmailStep() {
  const context = signup.useContext();

  return (
    <input
      value={context.email}
      onChange={(event) =>
        signup.updateContext((context) => ({ ...context, email: event.target.value }))
      }
    />
  );
}

function ReviewStep() {
  // The awaited gate: \`run\` holds the machine on this step until it settles, and
  // a rejection cancels the move and lands in \`currentStep.async.error\`.
  signup.useStepHandler("review", {
    run: ({ snapshot }) => submitOrder(snapshot.context.email),
    commit: ({ result, updateContext }) =>
      updateContext((context) => ({ ...context, orderId: result.orderId }))
  });

  return <p>Review and place the order.</p>;
}

function DoneStep() {
  const context = signup.useContext();
  const controls = signup.useControls();

  // Position and outcome are separate: reaching the last step does not finish it.
  return (
    <button onClick={() => controls.complete()}>
      Order {context.orderId} placed — finish
    </button>
  );
}

function Controls() {
  const step = signup.useStep();
  const isLoading = signup.useSelector((snapshot) => snapshot.machine.isLoading);

  return (
    <>
      {step?.async.error ? <p role="alert">{String(step.async.error)}</p> : null}
      <button disabled={isLoading} onClick={() => void signup.navigate.goToNextStep()}>
        {isLoading ? "Working…" : "Continue"}
      </button>
    </>
  );
}

export function Signup() {
  return (
    <signup.Provider
      // Typed exhaustively: a missing or misspelled step id fails to compile.
      views={{ email: <EmailStep />, review: <ReviewStep />, done: <DoneStep /> }}
    >
      <signup.StepRenderer />
      <Controls />
    </signup.Provider>
  );
}`;

export const HomeFlowComparison = (): ReactNode => {
  return (
    <section className={styles.wrapper} aria-labelledby="home-comparison-heading">
      <div className={styles.intro}>
        <h2 id="home-comparison-heading" className={styles.heading}>
          A step index is fine, right up until it isn&apos;t
        </h2>
        <p className={styles.subheading}>
          Branching, real back behavior, pre-commit async work, and observability are the parts you
          end up writing yourself. Journey makes them the default.
        </p>
      </div>

      <div className={styles.grid}>
        <div className={styles.column}>
          <p className={`${styles.columnLabel} ${styles.columnLabelBefore}`}>The usual approach</p>
          <CodeBlock language="tsx" className={styles.codeBlock}>
            {INDEX_SNIPPET}
          </CodeBlock>
        </div>

        <div className={styles.column}>
          <p className={`${styles.columnLabel} ${styles.columnLabelAfter}`}>With Journey</p>
          <CodeBlock language="tsx" className={styles.codeBlock}>
            {JOURNEY_SNIPPET}
          </CodeBlock>
        </div>
      </div>
    </section>
  );
};
