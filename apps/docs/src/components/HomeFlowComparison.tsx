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
 * Mirrors the linear example in `docs/react/overview.md`. Keep the two in sync;
 * this snippet is the first API a visitor sees.
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
      <EmailStep id="email" />
      <TermsStep id="terms" />
      <ReviewStep id="review" />
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
