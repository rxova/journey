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
 * show a pre-1.0 shape. Every symbol is a real export, and the props match
 * `LinearJourneyProps`: `context` and `onComplete` (which receives core's
 * `statusChange` payload, hence `{ snapshot }`). `machine.context.update` is the
 * grouped command at `packages/core/src/core/types.ts:417`.
 *
 * `onComplete` is deliberately shown with its own try/catch. It is an observer,
 * not a gate: `linear.tsx:173` discards the return value, and core's `emit`
 * (`core/store.ts:104-116`) calls listeners synchronously inside a try/catch that
 * only catches sync throws — a rejected promise from an async handler escapes as
 * an unhandled rejection. The awaited pre-commit gate is navigation work
 * (`NavigationWork.run`, `core/types.ts:357-366`), which the machine does await.
 *
 * The inline `id` is the contract in `derive-steps.tsx:84-103`: `<LinearJourney>`
 * reads `id` off the child and strips it before rendering, so a step declares
 * `id?: string` and never reads it. That optional-and-unused shape is exactly how
 * the repo's own `makeStep` test helper types a step
 * (`packages/react/src/__tests__/helpers.tsx:17-19`) — necessary because the global
 * `React.Attributes` `id` augmentation was removed before 1.0.
 */
const JOURNEY_SNIPPET = `import { LinearJourney, useLinearJourney } from "@rxova/journey-react";

type SignupContext = { email: string; acceptedTerms: boolean };

// <LinearJourney> reads \`id\` and strips it before render,
// so a step declares the prop but never reads it.
function EmailStep(_props: { id?: string }) {
  const { machine, snapshot } = useLinearJourney<SignupContext>();

  return (
    <label>
      Email
      <input
        value={snapshot.context.email}
        onChange={(event) =>
          machine.context.update((context) => ({
            ...context,
            email: event.target.value
          }))
        }
      />
    </label>
  );
}

export function Signup() {
  return (
    <LinearJourney
      context={{ email: "", acceptedTerms: false }}
      onComplete={async ({ snapshot }) => {
        // Observer, not a gate: the machine does not await this,
        // so handle failures here rather than letting them escape.
        try {
          await submitSignup(snapshot.context);
        } catch (error) {
          reportError(error);
        }
      }}
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
