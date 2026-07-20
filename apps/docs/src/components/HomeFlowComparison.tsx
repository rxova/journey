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
 * Why the submit lives in `useLinearJourneyStep` and not in `onComplete`:
 * `onComplete` is an observer, not a gate. `linear.tsx:171-175` calls it and
 * drops the result; core's `emit` (`core/store.ts:104-116`) is synchronous and
 * its try/catch only catches sync throws; and `setStatus`
 * (`core/runtime.ts:484-491`) commits the status and publishes the snapshot
 * *before* any listener runs. The awaited gate is `NavigationWork.run`
 * (`core/types.ts:357-366`), reached on the linear tier via
 * `useLinearJourneyStep` — a shell over `registerNextStepInterceptor`
 * (`use-linear-journey-step.ts:31-56`) whose rejection cancels the move and
 * lands in `currentStep.async.error`, with `machine.isLoading` true meanwhile.
 *
 * The work is attached to `review`, which has a successor on purpose:
 * `goToNextStep` returns `out-of-bounds` at the last declared step
 * (`core/runtime.ts:226-230`) *before* running any work, so a gate registered on
 * the final step would never fire.
 *
 * The inline `id` is the contract in `derive-steps.tsx:84-103`: `<LinearJourney>`
 * reads `id` off the child and strips it before rendering, so a step declares
 * `id?: string` and never reads it — the same shape as the repo's `makeStep`
 * helper (`packages/react/src/__tests__/helpers.tsx:17-19`).
 */
const JOURNEY_SNIPPET = `import { LinearJourney, useLinearJourney, useLinearJourneyStep } from "@rxova/journey-react";

type SignupContext = { email: string; orderId: string | null };

function EmailStep(_props: { id?: string }) {
  const { machine, snapshot } = useLinearJourney<SignupContext>();

  return (
    <input
      value={snapshot.context.email}
      onChange={(event) =>
        machine.context.update((context) => ({ ...context, email: event.target.value }))
      }
    />
  );
}

function ReviewStep(_props: { id?: string }) {
  // The awaited gate: \`run\` holds the machine on this step until it settles, and
  // a rejection cancels the move and lands in \`currentStep.async.error\`.
  useLinearJourneyStep<SignupContext, { orderId: string }>({
    run: ({ snapshot }) => submitOrder(snapshot.context.email),
    commit: ({ result, updateContext }) =>
      updateContext((context) => ({ ...context, orderId: result.orderId }))
  });

  return <p>Review and place the order.</p>;
}

function DoneStep(_props: { id?: string }) {
  const { machine, snapshot } = useLinearJourney<SignupContext>();

  // Position and outcome are separate: reaching the last step does not finish it.
  return (
    <button onClick={() => machine.controls.complete()}>
      Order {snapshot.context.orderId} placed — finish
    </button>
  );
}

function Controls() {
  const { machine, snapshot } = useLinearJourney<SignupContext>();
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
    <LinearJourney
      context={{ email: "", orderId: null }}
      footer={<Controls />}
      // Observer only: the status is already committed before this runs.
      onComplete={({ snapshot }) => analytics.track("signup_complete", snapshot.context)}
    >
      <EmailStep id="email" />
      <ReviewStep id="review" />
      <DoneStep id="done" />
    </LinearJourney>
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
