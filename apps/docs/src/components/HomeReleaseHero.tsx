import type { ReactNode } from "react";
import Link from "@docusaurus/Link";
import styles from "./HomeReleaseHero.module.css";

const RELEASE_VERSION = "1.0.0";

const heroHighlights = [
  {
    title: "Core + React",
    body: "Production graph flows, hooks, and step rendering patterns across the 1.0 line."
  },
  {
    title: "Documentation",
    body: "Getting-started paths, package navigation, and API references across Core and React."
  },
  {
    title: "Chrome DevTools",
    body: "Inspect timeline, state diffs, and command outcomes while you run real non-linear flows."
  },
  {
    title: "Stable API",
    body: "The 1.0 contract is settling ahead of launch, so you can build against it today."
  }
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
            Version {RELEASE_VERSION} · Preparing for launch
          </div>

          <div className="space-y-4">
            <h1 className={styles.headline}>
              Typed flows for non-linear UI
              <span className={styles.headlineAccent}>Journey {RELEASE_VERSION}</span>
            </h1>
            <p className={styles.lede}>
              Journey is on the 1.0 line and preparing for launch. It ships production-ready flow
              primitives, React bindings, and the tooling needed to inspect real non-linear UI work.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className={`${ctaClasses} bg-ink-900 text-white hover:bg-ink-800 dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100`}
              to="/docs/core/getting-started"
            >
              Start with Core
            </Link>
            <Link
              className={`${ctaClasses} bg-ink-900 text-white hover:bg-ink-800 dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100`}
              to="/docs/react/overview"
            >
              Explore React
            </Link>
            <Link
              className={`${ctaClasses} border border-ink-400/70 bg-white/80 text-ink-900 hover:border-ink-500 hover:bg-white dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:border-white/40 dark:hover:bg-white/16`}
              to="/docs/core/plugins/overview"
            >
              See the Plugins
            </Link>
            <Link
              className={`${ctaClasses} border border-brand-400 bg-brand-100 text-brand-900 hover:border-brand-500 hover:bg-brand-200 dark:border-brand-300 dark:bg-brand-300/20 dark:text-brand-100 dark:hover:border-brand-200 dark:hover:bg-brand-300/30`}
              to="/docs/core/releases"
            >
              Read Release Notes
            </Link>
          </div>

          <p className={styles.microcopy}>
            Core, React bindings, and DevTools across the 1.0 line.
          </p>

          <section className={styles.sidePanel} aria-label="Release highlights">
            <p className={styles.sidePanelLabel}>Status</p>
            <p className={styles.sidePanelVersion}>{RELEASE_VERSION}</p>
            <p className={styles.sidePanelBody}>
              Stable graph modeling, documented APIs, and observability for flows that do not fit
              neatly into linear wizards.
            </p>

            <div className={styles.metricGrid}>
              {heroHighlights.map((highlight) => (
                <div key={highlight.title} className={styles.metricCard}>
                  <p className={styles.metricTitle}>{highlight.title}</p>
                  <p className={styles.metricBody}>{highlight.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
