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
 * (`LinearJourneyViews` in `linear.types.ts` maps every declared id).
 *
 * Why the submit lives in `signup.useStep` and not in `onComplete`:
 * `onComplete` is an observer, not a gate — the runtime forwards core's
 * `statusChange` after the status is already committed, and core's emit is
 * synchronous and drops listener results. The awaited gate is
 * `NavigationWork.run`, reached on the linear tier via `useStep` — a shell
 * over `registerNextStepInterceptor` (`use-linear-journey-step.ts`) whose
 * rejection cancels the move and lands in `currentStep.async.error`, with
 * `machine.isLoading` true meanwhile.
 *
 * The work is attached to `review`, which has a successor on purpose:
 * `goToNextStep` returns `out-of-bounds` at the last declared step *before*
 * running any work, so a gate registered on the final step would never fire.
 */
const JOURNEY_SNIPPET = `import { createLinearJourney } from "@rxova/journey-react";

type SignupContext = { email: string; orderId: string | null };
const initialContext: SignupContext = { email: "", orderId: null };

// The typed factory: context and step ids are inferred once, here. No machine
// yet — each <signup.Provider> mount owns one.
const signup = createLinearJourney({
  context: initialContext,
  steps: ["email", "review", "done"]
});

function EmailStep() {
  const { machine, snapshot } = signup.useJourney();

  return (
    <input
      value={snapshot.context.email}
      onChange={(event) =>
        machine.context.update((context) => ({ ...context, email: event.target.value }))
      }
    />
  );
}

function ReviewStep() {
  // The awaited gate: \`run\` holds the machine on this step until it settles, and
  // a rejection cancels the move and lands in \`currentStep.async.error\`.
  signup.useStep<{ orderId: string }>({
    run: ({ snapshot }) => submitOrder(snapshot.context.email),
    commit: ({ result, updateContext }) =>
      updateContext((context) => ({ ...context, orderId: result.orderId }))
  });

  return <p>Review and place the order.</p>;
}

function DoneStep() {
  const { machine, snapshot } = signup.useJourney();

  // Position and outcome are separate: reaching the last step does not finish it.
  return (
    <button onClick={() => machine.controls.complete()}>
      Order {snapshot.context.orderId} placed — finish
    </button>
  );
}

function Controls() {
  const { machine, snapshot } = signup.useJourney();
  const { error } = snapshot.currentStep.async;

  return (
    <>
      {error ? <p role="alert">{String(error)}</p> : null}
      <button
        disabled={snapshot.machine.isLoading}
        onClick={() => void machine.navigate.goToNextStep()}
      >
        {snapshot.machine.isLoading ? "Working…" : "Continue"}
      </button>
    </>
  );
}

export function Signup() {
  return (
    <signup.Provider
      // Typed exhaustively: a missing or misspelled step id fails to compile.
      views={{ email: <EmailStep />, review: <ReviewStep />, done: <DoneStep /> }}
      footer={<Controls />}
      // Observer only: the status is already committed before this runs.
      onComplete={({ snapshot }) => analytics.track("signup_complete", snapshot.context)}
    />
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
