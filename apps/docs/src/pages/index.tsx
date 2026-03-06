import { useEffect, useState, type ReactNode } from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";

const ctaClasses =
  "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

const Card = ({ title, body, href }: { title: string; body: string; href: string }) => (
  <Link
    to={href}
    className="home-surface group block rounded-2xl border border-ink-300/80 bg-white/95 p-6 shadow-[0_20px_44px_-28px_rgba(20,35,60,0.38)] backdrop-blur-sm transition hover:-translate-y-1 hover:border-ink-400/80 hover:shadow-[0_24px_52px_-30px_rgba(20,35,60,0.45)] dark:hover:border-[#5f6d95]"
  >
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold text-ink-900 group-hover:text-brand-700 dark:text-ink-50 dark:group-hover:text-brand-200">
          {title}
        </h3>
        <p className="mt-2 break-words text-sm text-ink-600 dark:text-ink-100">{body}</p>
      </div>
      <span className="ml-auto shrink-0 text-base font-semibold leading-none text-brand-700 dark:text-brand-300">
        →
      </span>
    </div>
  </Link>
);

type FeatureSlide = {
  title: string;
  body: string;
  href?: string;
};

const featureSlides: FeatureSlide[] = [
  {
    title: "Test Coverage",
    body: "95%+ coverage baseline across critical runtime paths, React bindings, and integration behavior that ships in every release."
  },
  {
    title: "Tiny, Zero Dependency",
    body: "Core runtime stays compact with zero runtime dependencies, keeping installs lean and bundle behavior predictable across environments."
  },
  {
    title: "Tree-shakeable",
    body: "Import only the pieces you need across Core, React bindings, and the bridge package so bundles stay clean and focused."
  },
  {
    title: "DevTools",
    body: "Inspect timeline, state diffs, and command outcomes directly in Chrome DevTools while your app runs in real time.",
    href: "https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm"
  },
  {
    title: "CI Quality Gates",
    body: "8+ CI gates cover multi-node matrix runs, audit checks, size budgets, pack smoke validation, and changeset enforcement."
  },
  {
    title: "Active Development",
    body: "Active iteration continues with regular releases, updated docs, and expanded tests that track new behavior and fixes."
  }
];

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  const coreSections = [
    {
      title: "History",
      body: "Deterministic back behavior with timeline-pointer navigation and fallback previous-step semantics.",
      href: "/docs/core/history"
    },
    {
      title: "Persistence",
      body: "Versioned snapshot storage, migrations, reset semantics, and adapter boundaries.",
      href: "/docs/core/persistence"
    },
    {
      title: "Snapshot",
      body: "Read currentStepId/context/history/visited/async state with predictable runtime invariants.",
      href: "/docs/core/snapshot"
    },
    {
      title: "Lifecycle",
      body: "Transition selection pipeline, terminal behavior, queue semantics, and error lifecycle.",
      href: "/docs/core/lifecycle"
    },
    {
      title: "Async",
      body: "Async guards/effects and robust loading/error UI patterns around explicit phases.",
      href: "/docs/core/async"
    },
    {
      title: "Examples",
      body: "Headless example catalog mapped to real scenarios and feature-focused flows.",
      href: "/docs/core/examples"
    }
  ];

  const reactSections = [
    {
      title: "Provider + Hooks API",
      body: "Understand bindings.Provider, StepRenderer, and core hooks for production wiring.",
      href: "/docs/react/provider-and-hooks"
    },
    {
      title: "Patterns",
      body: "Practical structure patterns for step components, controls, and machine ownership.",
      href: "/docs/react/patterns"
    },
    {
      title: "Async UI",
      body: "Render loading and error states from snapshot.async without ad-hoc local state.",
      href: "/docs/react/async-ui"
    },
    {
      title: "Examples",
      body: "Explore complete React flows you can adapt directly in your app.",
      href: "/docs/react/examples"
    }
  ];
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselTimerVersion, setCarouselTimerVersion] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % featureSlides.length);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [carouselTimerVersion]);

  const resetCarouselTimer = () => {
    setCarouselTimerVersion((version) => version + 1);
  };

  const goToPreviousSlide = () => {
    setActiveSlide((current) => (current - 1 + featureSlides.length) % featureSlides.length);
    resetCarouselTimer();
  };

  const goToNextSlide = () => {
    setActiveSlide((current) => (current + 1) % featureSlides.length);
    resetCarouselTimer();
  };

  const currentSlide = featureSlides[activeSlide];
  const previousSlideIndex = (activeSlide - 1 + featureSlides.length) % featureSlides.length;
  const nextSlideIndex = (activeSlide + 1) % featureSlides.length;
  const visibleSlides: Array<{
    key: "previous" | "current" | "next";
    index: number;
    slide: FeatureSlide;
  }> = [
    { key: "previous", index: previousSlideIndex, slide: featureSlides[previousSlideIndex] },
    { key: "current", index: activeSlide, slide: currentSlide },
    { key: "next", index: nextSlideIndex, slide: featureSlides[nextSlideIndex] }
  ];

  return (
    <Layout
      title={siteConfig.title}
      description="Rxova Journey docs for building non-linear flows with a declarative journey graph."
    >
      <main className="min-h-screen bg-gradient-to-b from-white via-ink-50 to-white dark:from-[#181a24] dark:via-[#1b1e2b] dark:to-[#171923]">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-fade bg-[length:24px_24px] opacity-60 dark:opacity-20" />
          <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-brand-200/60 blur-3xl dark:bg-[#8e7dff]/10" />
          <div className="absolute -bottom-40 left-0 h-80 w-80 rounded-full bg-ink-200/50 blur-3xl dark:bg-[#6b78a0]/10" />

          <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20 sm:px-10">
            <div className="flex flex-col gap-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-500 dark:text-ink-300">
                Rxova Journey Docs
              </p>
              <h1 className="text-4xl font-semibold text-ink-900 sm:text-5xl lg:text-6xl dark:text-white">
                Declarative journey graphs for non-linear UI flows.
              </h1>
              <p className="max-w-2xl text-base text-ink-600 sm:text-lg dark:text-ink-200">
                Model complex flows as a graph of steps and transitions, then render them in React
                or run headless in tests and services.
              </p>
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
                  className={`${ctaClasses} pl-4 border border-brand-400 bg-brand-100 text-brand-900 hover:border-brand-500 hover:bg-brand-200 dark:border-brand-300 dark:bg-brand-300/20 dark:text-brand-100 dark:hover:border-brand-200 dark:hover:bg-brand-300/30`}
                  to="/docs/devtool/overview"
                >
                  <span className="mr-2 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white dark:bg-brand-200 dark:text-ink-900">
                    New!
                  </span>
                  Chrome Developer DevTools
                </Link>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="home-surface rounded-2xl border border-ink-300/80 bg-white/90 p-6 shadow-[0_20px_44px_-28px_rgba(20,35,60,0.38)] transition hover:-translate-y-1 hover:border-ink-400/80 hover:shadow-[0_24px_52px_-30px_rgba(20,35,60,0.45)] dark:hover:border-[#5f6d95]">
                  <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-ink-900 dark:text-ink-50">
                    Why Journey
                  </p>
                  <p className="mt-3 text-sm text-ink-700 dark:text-ink-100">
                    Replace brittle step arrays with a typed transition graph. Handle branching,
                    async guards, and deterministic back behavior without scattered state.
                  </p>
                </div>
                <div className="home-surface rounded-2xl border border-ink-300/80 bg-white/90 p-6 shadow-[0_20px_44px_-28px_rgba(20,35,60,0.38)] transition hover:-translate-y-1 hover:border-ink-400/80 hover:shadow-[0_24px_52px_-30px_rgba(20,35,60,0.45)] dark:hover:border-[#5f6d95]">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white dark:bg-brand-200 dark:text-ink-900">
                      New!
                    </span>
                    <span className="text-sm font-extrabold uppercase tracking-[0.14em] text-ink-900 dark:text-ink-50">
                      Status
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink-700 dark:text-ink-100">
                    Since version 0.6.1, docs are versioned per package so you can switch between
                    released versions in each docs section.
                  </p>
                </div>
                <div className="home-surface rounded-2xl border border-ink-300/80 bg-white/90 p-6 shadow-[0_20px_44px_-28px_rgba(20,35,60,0.38)] transition hover:-translate-y-1 hover:border-ink-400/80 hover:shadow-[0_24px_52px_-30px_rgba(20,35,60,0.45)] dark:hover:border-[#5f6d95]">
                  <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-ink-900 dark:text-ink-50">
                    Packages
                  </p>
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    <Link
                      href="https://www.npmjs.com/package/@rxova/journey-core"
                      className="-mx-2 block rounded-lg px-2 py-1 text-ink-700 transition hover:bg-brand-50 hover:text-brand-700 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-ink-50 dark:hover:bg-ink-700/60 dark:hover:text-brand-200"
                    >
                      @rxova/journey-core
                    </Link>
                    <Link
                      href="https://www.npmjs.com/package/@rxova/journey-react"
                      className="-mx-2 block rounded-lg px-2 py-1 text-ink-700 transition hover:bg-brand-50 hover:text-brand-700 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-ink-50 dark:hover:bg-ink-700/60 dark:hover:text-brand-200"
                    >
                      @rxova/journey-react
                    </Link>
                    <Link
                      href="https://www.npmjs.com/package/@rxova/journey-devtools-bridge"
                      className="-mx-2 block rounded-lg px-2 py-1 text-ink-700 transition hover:bg-brand-50 hover:text-brand-700 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-ink-50 dark:hover:bg-ink-700/60 dark:hover:text-brand-200"
                    >
                      @rxova/journey-devtools-bridge
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-1 py-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-base font-extrabold uppercase tracking-[0.2em] text-ink-900 md:text-lg dark:text-ink-50">
                  Why Teams Pick Journey
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous feature"
                    onClick={goToPreviousSlide}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-ink-300 text-ink-700 transition hover:-translate-y-0.5 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 hover:shadow-[0_8px_18px_-12px_rgba(20,35,60,0.55)] active:translate-y-0 dark:border-ink-500 dark:text-ink-100 dark:hover:border-brand-300 dark:hover:bg-brand-300/20 dark:hover:text-brand-200"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next feature"
                    onClick={goToNextSlide}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-ink-300 text-ink-700 transition hover:-translate-y-0.5 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 hover:shadow-[0_8px_18px_-12px_rgba(20,35,60,0.55)] active:translate-y-0 dark:border-ink-500 dark:text-ink-100 dark:hover:border-brand-300 dark:hover:bg-brand-300/20 dark:hover:text-brand-200"
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="feature-carousel-shell mt-4 overflow-hidden">
                <div
                  key={activeSlide}
                  className="feature-carousel-stage mx-auto flex max-w-[980px] items-center justify-center gap-0"
                >
                  {visibleSlides.map(({ key, index, slide }) => {
                    const isCenter = key === "current";
                    const sharedClasses =
                      "feature-carousel-card flex-none rounded-2xl border bg-white/95 text-left transition dark:bg-ink-900/55";
                    const centerClasses =
                      "feature-carousel-card--current w-[68%] md:w-[56%] border-brand-300/80 p-5 opacity-100 shadow-[0_24px_56px_-34px_rgba(20,35,60,0.45)]";
                    const sideClasses =
                      "feature-carousel-card--side w-[68%] md:w-[56%] scale-[0.9] border-ink-200/90 p-5 opacity-65 hover:opacity-85 dark:border-ink-600/90";

                    if (isCenter) {
                      return (
                        <div key={slide.title} className={`${sharedClasses} ${centerClasses}`}>
                          <div>
                            <p className="text-2xl font-semibold text-ink-900 dark:text-ink-50 md:text-[1.7rem]">
                              {slide.title}
                            </p>
                            <p className="mt-2 text-base leading-relaxed text-ink-700 dark:text-ink-100">
                              {slide.body}
                            </p>
                            <div className="pt-3">
                              {slide.href ? (
                                <Link
                                  href={slide.href}
                                  className="inline-flex text-base font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
                                >
                                  Download from Chrome Web Store →
                                </Link>
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className="inline-flex text-base font-semibold invisible"
                                >
                                  Download from Chrome Web Store →
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={slide.title}
                        type="button"
                        aria-label={`Show ${slide.title}`}
                        onClick={() => {
                          setActiveSlide(index);
                          resetCarouselTimer();
                        }}
                        className={`${sharedClasses} ${sideClasses}`}
                      >
                        <div className="flex h-full flex-col">
                          <p className="text-lg font-semibold text-ink-900 dark:text-ink-100 md:text-xl">
                            {slide.title}
                          </p>
                          <p className="mt-2 text-base leading-relaxed text-ink-600 dark:text-ink-200">
                            {slide.body}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 text-right text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-300">
                {activeSlide + 1} / {featureSlides.length}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card
                title="Core: the headless engine"
                body="Define steps, transitions, lifecycle, history, and persistence without UI assumptions."
                href="/docs/core/getting-started"
              />
              <Card
                title="React: the UI bindings"
                body="Render active steps with provider/hooks and keep business flow rules in Core."
                href="/docs/react/overview"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {coreSections.map((item) => (
                <Card
                  key={item.title}
                  title={`Core: ${item.title}`}
                  body={item.body}
                  href={item.href}
                />
              ))}
            </div>
            <div className="home-surface rounded-2xl border border-ink-300/80 bg-white/90 p-6 shadow-[0_20px_44px_-28px_rgba(20,35,60,0.38)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-300">
                  React Guides
                </p>
                <Link
                  to="/docs/react/overview"
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 transition hover:text-brand-800 hover:no-underline dark:text-brand-300 dark:hover:text-brand-200"
                >
                  Open React Overview →
                </Link>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {reactSections.map((item) => (
                  <Link
                    key={item.title}
                    to={item.href}
                    className="rounded-xl border border-ink-200 bg-white/80 px-4 py-3 transition hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50/60 hover:no-underline dark:border-ink-600/80 dark:bg-ink-800/50 dark:hover:border-brand-300 dark:hover:bg-ink-700/60"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-brand-700 dark:text-brand-300">●</span>
                      <div>
                        <p className="text-sm font-semibold text-ink-800 dark:text-ink-50">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-ink-600 dark:text-ink-200">{item.body}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
