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
 * Verified against `packages/react/src` — not against the prose docs, which still
 * show a pre-1.0 shape. Every symbol here is a real export, and the props match
 * `LinearJourneyProps`: `context`, `footer`, and `onComplete` (which receives
 * core's `statusChange` payload, hence `{ snapshot }`).
 *
 * Steps use the `<LinearJourney.Step id>` wrapper deliberately: the global
 * `React.Attributes` `id` augmentation was removed before 1.0, so an inline
 * `<EmailStep id="email" />` only typechecks when that component declares its
 * own `id` prop. The wrapper always does.
 */
const JOURNEY_SNIPPET = `import { LinearJourney, useLinearJourney } from "@rxova/journey-react";

function Footer() {
  const { machine, snapshot } = useLinearJourney<SignupContext>();

  return (
    <nav>
      <button
        disabled={!snapshot.history.canGoBack}
        onClick={() => void machine.navigate.goToPreviousStep()}
      >
        Back
      </button>
      <button
        disabled={snapshot.machine.isLoading}
        onClick={() => void machine.navigate.goToNextStep()}
      >
        Continue
      </button>
    </nav>
  );
}

export function Signup() {
  return (
    <LinearJourney
      context={{ email: "", acceptedTerms: false }}
      footer={<Footer />}
      onComplete={({ snapshot }) => submitSignup(snapshot.context)}
    >
      <LinearJourney.Step id="email">
        <EmailStep />
      </LinearJourney.Step>
      <LinearJourney.Step id="terms">
        <TermsStep />
      </LinearJourney.Step>
      <LinearJourney.Step id="review">
        <ReviewStep />
      </LinearJourney.Step>
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
