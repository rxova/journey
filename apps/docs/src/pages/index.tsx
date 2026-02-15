import type { ReactNode } from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";

const ctaClasses =
  "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

const Card = ({ title, body, href }: { title: string; body: string; href: string }) => (
  <Link
    to={href}
    className="group block rounded-2xl border border-ink-200/70 bg-white/70 p-6 shadow-soft backdrop-blur transition hover:-translate-y-1 hover:border-ink-300 hover:shadow-lg dark:border-ink-800/60 dark:bg-ink-900/60"
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold text-ink-900 group-hover:text-brand-700 dark:text-white">
          {title}
        </h3>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-200">{body}</p>
      </div>
      <span className="text-sm font-semibold text-brand-700">→</span>
    </div>
  </Link>
);

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout
      title={siteConfig.title}
      description="Rxova Journey docs for building non-linear flows with a declarative journey graph."
    >
      <main className="min-h-screen bg-gradient-to-b from-white via-ink-50 to-white dark:from-ink-900 dark:via-ink-900 dark:to-ink-950">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-fade bg-[length:24px_24px] opacity-60" />
          <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-brand-200/60 blur-3xl dark:bg-brand-500/20" />
          <div className="absolute -bottom-40 left-0 h-80 w-80 rounded-full bg-ink-200/50 blur-3xl dark:bg-ink-700/30" />

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
                  className={`${ctaClasses} border border-ink-300 text-ink-700 hover:border-ink-400 dark:border-ink-700 dark:text-ink-100 dark:hover:border-ink-500`}
                  to="/docs/react/overview"
                >
                  Explore React
                </Link>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card
                title="Core: the headless engine"
                body="Define steps, transitions, and context without UI assumptions."
                href="/docs/core/getting-started"
              />
              <Card
                title="React: the UI bindings"
                body="Render the active step with a provider + hooks."
                href="/docs/react/overview"
              />
            </div>
            <div className="grid gap-6 pb-4 pt-6 sm:pb-6 sm:pt-8 lg:grid-cols-3">
              <div className="rounded-2xl border border-ink-200/70 bg-white/80 p-6 shadow-soft transition hover:-translate-y-1 hover:border-ink-300 hover:shadow-lg dark:border-ink-800/60 dark:bg-ink-900/60 dark:hover:border-ink-700">
                <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-ink-900 dark:text-white">
                  Why Journey
                </p>
                <p className="mt-3 text-sm text-ink-700 dark:text-ink-200">
                  Replace brittle step arrays with a typed transition graph. Handle branching, async
                  guards, and deterministic back behavior without scattered state.
                </p>
              </div>
              <div className="rounded-2xl border border-ink-200/70 bg-white/80 p-6 shadow-soft transition hover:-translate-y-1 hover:border-ink-300 hover:shadow-lg dark:border-ink-800/60 dark:bg-ink-900/60 dark:hover:border-ink-700">
                <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-ink-900 dark:text-white">
                  Status
                </p>
                <p className="mt-3 text-sm text-ink-700 dark:text-ink-200">
                  Pre-1.0 releases are moving fast. Docs always reflect the latest published version
                  until 1.0 lands.
                </p>
              </div>
              <div className="rounded-2xl border border-ink-200/70 bg-white/80 p-6 shadow-soft transition hover:-translate-y-1 hover:border-ink-300 hover:shadow-lg dark:border-ink-800/60 dark:bg-ink-900/60 dark:hover:border-ink-700">
                <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-ink-900 dark:text-white">
                  Packages
                </p>
                <div className="mt-3 flex flex-col gap-2 text-sm">
                  <Link
                    href="https://www.npmjs.com/package/@rxova/journey-core"
                    className="-mx-2 block rounded-lg px-2 py-1 text-ink-700 transition hover:bg-brand-50 hover:text-brand-700 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-ink-100 dark:hover:bg-ink-700/50 dark:hover:text-white"
                  >
                    @rxova/journey-core
                  </Link>
                  <Link
                    href="https://www.npmjs.com/package/@rxova/journey-react"
                    className="-mx-2 block rounded-lg px-2 py-1 text-ink-700 transition hover:bg-brand-50 hover:text-brand-700 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-ink-100 dark:hover:bg-ink-700/50 dark:hover:text-white"
                  >
                    @rxova/journey-react
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
