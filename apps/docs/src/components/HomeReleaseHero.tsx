import { useCallback, type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "@docusaurus/Link";
import useIsBrowser from "@docusaurus/useIsBrowser";
import confetti from "canvas-confetti";
import styles from "./HomeReleaseHero.module.css";

const RELEASE_VERSION = "1.0.0rc";
const STORAGE_KEY = `rxova-journey-docs-release-celebration:${RELEASE_VERSION}`;

const heroHighlights = [
  {
    title: "Core + React",
    body: "Production-ready graph flows, hooks, and step rendering patterns packaged for the 1.0 line."
  },
  {
    title: "Docs polish",
    body: "Sharper getting-started paths, package navigation, and release candidate messaging from the first screen."
  },
  {
    title: "Chrome DevTools",
    body: "Inspect timeline, state diffs, and command outcomes while you push real non-linear flows."
  },
  {
    title: "Ready to test",
    body: "Kick the tires now, validate your flows, and help close out the final march to 1.0."
  }
] as const;

type HomeReleaseHeroProps = {
  ctaClasses: string;
};

export const HomeReleaseHero = ({ ctaClasses }: HomeReleaseHeroProps): ReactNode => {
  const isBrowser = useIsBrowser();
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState(false);

  const closeCelebration = useCallback(() => {
    setIsCelebrationOpen(false);

    if (!isBrowser) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, "seen");
    } catch {
      // Ignore storage failures and keep the UI functional.
    }
  }, [isBrowser]);

  const openCelebration = useCallback(() => {
    setIsCelebrationOpen(true);
  }, []);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== "seen") {
        setIsCelebrationOpen(true);
      }
    } catch {
      setIsCelebrationOpen(true);
    }
  }, [isBrowser]);

  useEffect(() => {
    if (!isCelebrationOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusButton = window.requestAnimationFrame(() => {
      primaryButtonRef.current?.focus();
    });

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCelebration();
      }
    };

    document.addEventListener("keydown", onEscape);

    return () => {
      window.cancelAnimationFrame(focusButton);
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeCelebration, isCelebrationOpen]);

  useEffect(() => {
    if (!isBrowser || !isCelebrationOpen) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const canvas = confettiCanvasRef.current;

    if (!canvas) {
      return;
    }

    const fire = confetti.create(canvas, {
      resize: true,
      useWorker: true
    });

    const bursts = [
      window.setTimeout(() => {
        fire({
          particleCount: 90,
          spread: 88,
          startVelocity: 34,
          origin: { x: 0.22, y: 0.18 },
          colors: ["#57f1c4", "#ffd166", "#7cc6ff", "#f78fb3", "#c4f268"],
          ticks: 220
        });
      }, 0),
      window.setTimeout(() => {
        fire({
          particleCount: 72,
          spread: 78,
          startVelocity: 30,
          origin: { x: 0.78, y: 0.22 },
          colors: ["#57f1c4", "#ffd166", "#7cc6ff", "#f78fb3", "#c4f268"],
          ticks: 200
        });
      }, 180),
      window.setTimeout(() => {
        fire({
          particleCount: 54,
          spread: 110,
          startVelocity: 26,
          scalar: 0.9,
          origin: { x: 0.5, y: 0.12 },
          colors: ["#57f1c4", "#ffd166", "#7cc6ff", "#f78fb3", "#c4f268"],
          ticks: 180
        });
      }, 320)
    ];

    return () => {
      bursts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      fire.reset();
    };
  }, [isBrowser, isCelebrationOpen]);

  const onBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeCelebration();
    }
  };

  return (
    <>
      <div className={styles.heroShell}>
        <div className={styles.heroGrid}>
          <div className="flex flex-col gap-6">
            <div className={styles.eyebrow}>
              <span aria-hidden="true" className={styles.eyebrowDot} />
              Version {RELEASE_VERSION}
            </div>

            <div className="space-y-4">
              <h1 className={styles.headline}>
                We did it!
                <span className={styles.headlineAccent}>Journey {RELEASE_VERSION}</span>
              </h1>
              <p className={styles.lede}>
                The release candidate is here. Journey now lands with a sharper docs experience,
                production-ready flow primitives, and the tooling needed to inspect real non-linear
                UI work.
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
              Release candidate milestone across docs, core, React bindings, and DevTools.
            </p>
            <button type="button" className={styles.reopenButton} onClick={openCelebration}>
              Reopen the 1.0.0rc celebration
            </button>

            <section className={styles.sidePanel} aria-label="Release candidate highlights">
              <p className={styles.sidePanelLabel}>Release candidate highlights</p>
              <p className={styles.sidePanelVersion}>{RELEASE_VERSION}</p>
              <p className={styles.sidePanelBody}>
                Stable graph modeling, stronger docs, and better observability for flows that do not
                fit neatly into linear wizards.
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

      {isBrowser &&
        isCelebrationOpen &&
        createPortal(
          <div className={styles.modalOverlay} onMouseDown={onBackdropMouseDown}>
            <canvas ref={confettiCanvasRef} className={styles.confettiCanvas} aria-hidden="true" />

            <div
              className={styles.modalDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="release-celebration-title"
              aria-describedby="release-celebration-copy"
            >
              <div className={styles.modalInner}>
                <div className={styles.modalHeader}>
                  <div className={styles.modalEyebrow}>
                    <span aria-hidden="true" className={styles.eyebrowDot} />
                    Release candidate unlocked
                  </div>
                  <button
                    type="button"
                    className={styles.modalClose}
                    aria-label="Close release celebration"
                    onClick={closeCelebration}
                  >
                    ×
                  </button>
                </div>

                <div className={styles.modalBody}>
                  <div>
                    <h2 id="release-celebration-title" className={styles.modalTitle}>
                      We did it! <span className={styles.modalVersion}>{RELEASE_VERSION}</span>
                    </h2>
                    <p id="release-celebration-copy" className={styles.modalCopy}>
                      Journey has crossed into release-candidate territory. Explore the docs,
                      pressure-test your flows, and help us close out the final stretch to 1.0.
                    </p>
                  </div>

                  <div className={styles.modalActions}>
                    <button
                      ref={primaryButtonRef}
                      type="button"
                      className={styles.modalPrimaryButton}
                      onClick={closeCelebration}
                    >
                      Start exploring
                    </button>
                    <Link
                      to="/docs/core/releases"
                      className={styles.modalSecondaryLink}
                      onClick={closeCelebration}
                    >
                      See what shipped
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
