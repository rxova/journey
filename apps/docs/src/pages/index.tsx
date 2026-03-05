import type { ReactNode } from "react";
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
    { title: "Provider + Hooks API", href: "/docs/react/provider-and-hooks" },
    { title: "Patterns", href: "/docs/react/patterns" },
    { title: "Async UI", href: "/docs/react/async-ui" },
    { title: "Examples", href: "/docs/react/examples" }
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
                  className={`${ctaClasses} border border-ink-300 text-ink-700 hover:border-ink-400 dark:border-ink-500/80 dark:text-ink-50 dark:hover:border-brand-300 dark:hover:text-brand-200`}
                  to="/docs/devtool/overview"
                >
                  Check the Devtools Docs (Coming Soon)
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
                  <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-ink-900 dark:text-ink-50">
                    Status
                  </p>
                  <p className="mt-3 text-sm text-ink-700 dark:text-ink-100">
                    Pre-1.0 releases are moving fast. Docs are versioned per package so you can
                    switch between released versions in each docs section.
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-300">
                React Guides
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {reactSections.map((item) => (
                  <Link
                    key={item.title}
                    to={item.href}
                    className="rounded-xl border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-700 transition hover:border-brand-400 hover:text-brand-700 hover:no-underline dark:border-ink-600/80 dark:text-ink-50 dark:hover:border-brand-300 dark:hover:text-brand-200"
                  >
                    {item.title}
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
