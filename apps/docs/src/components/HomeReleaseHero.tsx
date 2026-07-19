import type { ReactNode } from "react";
import Link from "@docusaurus/Link";
import styles from "./HomeReleaseHero.module.css";

const RELEASE_VERSION = "1.0";

/**
 * Claims here must stay grounded in the repo: package manifests for dependency
 * and engine ranges, `size-limit` budgets for size, and `vitest.config.ts` for
 * the enforced coverage thresholds.
 */
const trustPoints = [
  "Zero runtime dependencies",
  "React 18.2+",
  "Node 20.11+",
  "95% coverage gates in CI",
  "MIT"
] as const;

type HomeReleaseHeroProps = {
  ctaClasses: string;
};

export const HomeReleaseHero = ({ ctaClasses }: HomeReleaseHeroProps): ReactNode => {
  return (
    <div className={styles.heroShell}>
      <div className={styles.heroGrid}>
        <div className="flex flex-col gap-6">
          <div className={styles.eyebrow}>
            <span aria-hidden="true" className={styles.eyebrowDot} />
            Version {RELEASE_VERSION}
          </div>

          <div className="space-y-4">
            <h1 className={styles.headline}>
              Multi-step flows that outgrew
              <span className={styles.headlineAccent}>
                <code className={styles.headlineCode}>useState(0)</code>
              </span>
            </h1>
            <p className={styles.lede}>
              Journey sits between a step index and a full statechart. Typed steps, branching
              graphs, a real history timeline, and async work that runs <em>before</em> a transition
              commits — in a framework-independent core with zero runtime dependencies.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              className={`${ctaClasses} bg-ink-900 text-white hover:bg-ink-800 dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100`}
              to="/docs/react/quickstart"
            >
              Get started
            </Link>
            <Link
              className={`${ctaClasses} border border-ink-400/70 bg-white/80 text-ink-900 hover:border-ink-500 hover:bg-white dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:border-white/40 dark:hover:bg-white/16`}
              to="/docs/core/getting-started"
            >
              Core docs
            </Link>
          </div>

          <ul className={styles.trustStrip}>
            {trustPoints.map((point) => (
              <li key={point} className={styles.trustPoint}>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
