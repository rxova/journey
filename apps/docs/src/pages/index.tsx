import type { ReactNode } from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import CodeBlock from "@theme/CodeBlock";
import Layout from "@theme/Layout";
import { HomeFlowComparison } from "../components/HomeFlowComparison";
import { HomeInstallTypewriter } from "../components/HomeInstallTypewriter";
import { HomeReleaseHero } from "../components/HomeReleaseHero";

const ctaClasses =
  "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

const sectionHeading =
  "text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50 sm:text-3xl";
const sectionLede = "mt-3 max-w-3xl text-sm leading-7 text-ink-600 dark:text-ink-100";
const surfaceCard =
  "home-surface rounded-2xl border border-ink-300/80 bg-white/95 p-6 shadow-[0_20px_44px_-28px_rgba(20,35,60,0.38)] transition hover:-translate-y-1 hover:border-ink-400/80 hover:shadow-[0_24px_52px_-30px_rgba(20,35,60,0.45)] dark:hover:border-[#5f6d95]";

const Card = ({ title, body, href }: { title: string; body: string; href: string }) => (
  <Link to={href} className={`${surfaceCard} group block`}>
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

const installCommands = [
  "npm install @rxova/journey-react react",
  "npm install @rxova/journey-core",
  "npm install @rxova/journey-devtools-bridge"
];

/**
 * Verified against `packages/react/src/graph.tsx` and `packages/core/src/graph` by
 * compiling this exact snippet with `tsc`. `checkout.send` is the machine's
 * `send`, verbatim on the bundle (`graph.tsx` — the factory creates one
 * standalone machine); the `send(type, work)` overload is core's `SendVerb`,
 * and `run`/`commit` semantics are `SendWork` — run is awaited while the
 * machine holds position, commit stages the context the guards are then
 * evaluated against. Candidate arrays resolve first-enabled-wins.
 */
const GRAPH_SNIPPET = `import { createGraphJourney } from "@rxova/journey-react/graph";

type CheckoutContext = { cartId: string; riskScore: number };
type CheckoutStepId = "payment" | "review" | "done";
type CheckoutEvents = { type: "submit" } | { type: "approve" };

const checkout = createGraphJourney<CheckoutContext, CheckoutStepId, CheckoutEvents>({
  initial: "payment",
  context: { cartId: "", riskScore: 0 },
  steps: { payment: {}, review: {}, done: {} },
  transitions: {
    // First enabled candidate wins, so order encodes the branch.
    submit: [
      { from: "payment", to: "review", when: ({ context }) => context.riskScore > 70 },
      { from: "payment", to: "done" }
    ],
    approve: { from: "review", to: "done" }
  }
});

export function PayButton() {
  // The machine is standalone on the bundle: \`checkout.send\` works here, in a
  // plain event handler, or outside React entirely.
  // \`run\` is awaited while the machine holds its position; \`commit\` stages the
  // context that the guards are then evaluated against.
  const submit = () =>
    checkout.send("submit", {
      run: ({ snapshot }) => scoreRisk(snapshot.context.cartId),
      commit: ({ result, updateContext }) =>
        updateContext((context) => ({ ...context, riskScore: result }))
    });

  return <button onClick={() => void submit()}>Pay</button>;
}`;

/** Surfaces and ownership match the table in `docs/react/overview.md`. */
const reactTiers = [
  {
    name: "Linear bundle",
    importPath: "@rxova/journey-react",
    body: "createLinearJourney captures your definition once and owns one standalone machine — typed Provider, StepRenderer, hooks, and verbatim navigate/updateContext, no generics at call sites. Reach for it first.",
    bestFit: "Ordinary ordered wizards",
    href: "/docs/react/quickstart"
  },
  {
    name: "Graph bundle",
    importPath: "@rxova/journey-react/graph",
    body: "The same bundle shape with graph verbs: named events, guards, and send choose the route instead of a fixed order. Hooks work with or without the Provider.",
    bestFit: "Branching, event-driven flows",
    href: "/docs/react/overview"
  },
  {
    name: "Bring your own machine",
    importPath: "@rxova/journey-core",
    body: "No bindings required: create a core machine yourself and read it with React's useSyncExternalStore. The react package exports the structural types (AnyJourneyMachine, SnapshotOf, …) to keep it typed.",
    bestFit: "Existing machines, custom rendering",
    href: "/docs/react/overview"
  }
] as const;

/** Condensed from the capability table in `docs/core/comparison.md`. */
const capabilities = [
  {
    title: "Named, typed step ids",
    body: "Steps are a typed union, not an integer. Renaming or reordering is a compile error, not a runtime surprise."
  },
  {
    title: "Event-driven branches",
    body: "Graph journeys pick a route from named events, synchronous guards, and ordered candidates."
  },
  {
    title: "A real history timeline",
    body: "Back walks the path the user actually took, with a timeline pointer — not step minus one."
  },
  {
    title: "Async before the commit",
    body: "Navigation work runs, and can fail, before a transition is applied. Navigation returns a result instead of throwing."
  },
  {
    title: "Explicit lifecycle outcome",
    body: "Position and completion are separate. Reaching the last step does not finish a journey; controls.complete() does."
  },
  {
    title: "One immutable snapshot",
    body: "Current step, context, history, and machine state read from a single snapshot that every consumer shares."
  }
] as const;

/** Sizes are the enforced `size-limit` budgets in each package manifest. */
const plugins = [
  { name: "Analytics", limit: "under 500 B", href: "/docs/core/plugins/analytics-plugin" },
  { name: "Autosave", limit: "under 750 B", href: "/docs/core/autosave" },
  { name: "Diagnostics", limit: "under 850 B", href: "/docs/core/plugins/diagnostics-plugin" },
  {
    name: "Execution paths",
    limit: "under 300 B",
    href: "/docs/core/plugins/execution-paths-plugin"
  },
  { name: "Persistence", limit: "under 500 B", href: "/docs/core/persistence" },
  { name: "Replay", limit: "under 850 B", href: "/docs/core/plugins/replay-plugin" },
  {
    name: "Subscriptions",
    limit: "under 250 B",
    href: "/docs/core/plugins/subscription-enhancer-plugin"
  }
] as const;

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout
      title={siteConfig.title}
      description="Typed state machines and React bindings for multi-step product flows."
    >
      <main className="min-h-screen bg-gradient-to-b from-white via-ink-50 to-white dark:from-[#181a24] dark:via-[#1b1e2b] dark:to-[#171923]">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-fade bg-[length:24px_24px] opacity-60 dark:opacity-20" />
          <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-brand-200/60 blur-3xl dark:bg-[#8e7dff]/10" />
          <div className="absolute -bottom-40 left-0 h-80 w-80 rounded-full bg-ink-200/50 blur-3xl dark:bg-[#6b78a0]/10" />

          <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 py-20 sm:px-10">
            <div className="flex flex-col gap-6">
              <HomeReleaseHero ctaClasses={ctaClasses} />
              <HomeInstallTypewriter
                commands={installCommands}
                className="mx-auto mt-2 self-center"
              />
            </div>

            <HomeFlowComparison />

            <section>
              <h2 className={sectionHeading}>And when it branches</h2>
              <p className={sectionLede}>
                Swap the linear tier for a graph and named events choose the route. The async that
                decides the branch runs <em>inside</em> the send: the machine holds its position
                while <code>run</code> is awaited, <code>commit</code> stages the result, and the
                guards are evaluated against that staged context. Guards never have to become async,
                and nothing moves if the work fails.
              </p>
              <div className="mt-8">
                <CodeBlock language="tsx">{GRAPH_SNIPPET}</CodeBlock>
              </div>
              <p className="mt-5 text-sm text-ink-600 dark:text-ink-100">
                The bundle also hands you <code>Provider</code>, <code>StepRenderer</code>, and
                typed hooks for the same machine.{" "}
                <Link to="/docs/react/overview" className="font-semibold">
                  See the graph tier
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className={sectionHeading}>Three ways in. Pick the one that fits.</h2>
              <p className={sectionLede}>
                The React package has three surfaces because ownership and authoring style differ
                across applications. All three drive the same Core machine and read the same
                snapshots.
              </p>
              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                {reactTiers.map((tier) => (
                  <Link key={tier.name} to={tier.href} className={`${surfaceCard} group block`}>
                    <h3 className="text-lg font-semibold text-ink-900 group-hover:text-brand-700 dark:text-ink-50 dark:group-hover:text-brand-200">
                      {tier.name}
                    </h3>
                    <code className="mt-2 block break-all font-mono text-xs text-brand-700 dark:text-brand-300">
                      {tier.importPath}
                    </code>
                    <p className="mt-3 text-sm text-ink-600 dark:text-ink-100">{tier.body}</p>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-300">
                      {tier.bestFit}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h2 className={sectionHeading}>What you stop hand-rolling</h2>
              <p className={sectionLede}>
                Journey keeps branching, history, guarded movement, and lifecycle in a small
                framework-independent machine — without adopting general statechart semantics.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {capabilities.map((capability) => (
                  <div key={capability.title} className={surfaceCard}>
                    <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">
                      {capability.title}
                    </h3>
                    <p className="mt-2 text-sm text-ink-600 dark:text-ink-100">{capability.body}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-ink-200 bg-white/70 px-6 py-5 dark:border-ink-600/80 dark:bg-ink-800/40">
                <p className="text-sm leading-7 text-ink-700 dark:text-ink-100">
                  <strong className="font-semibold text-ink-900 dark:text-ink-50">
                    When not to use it:
                  </strong>{" "}
                  Journey has no nested or parallel states and no actor model. If those are central
                  to your problem, reach for a general statechart engine instead.{" "}
                  <Link to="/docs/core/comparison" className="font-semibold">
                    See the full comparison
                  </Link>{" "}
                  or{" "}
                  <Link to="/docs/core/coming-from-xstate" className="font-semibold">
                    the XState concept map
                  </Link>
                  .
                </p>
              </div>
            </section>

            <section>
              <h2 className={sectionHeading}>Add only what you use</h2>
              <p className={sectionLede}>
                Persistence, analytics, and path enumeration are observe-only plugins rather than
                base-runtime features. Each ships with an enforced size budget.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {plugins.map((plugin) => (
                  <Link
                    key={plugin.name}
                    to={plugin.href}
                    className="home-surface group inline-flex items-baseline gap-2 rounded-full border border-ink-300/80 bg-white/95 px-5 py-2.5 transition hover:-translate-y-0.5 hover:border-brand-400 hover:no-underline dark:hover:border-brand-300"
                  >
                    <span className="text-sm font-semibold text-ink-900 group-hover:text-brand-700 dark:text-ink-50 dark:group-hover:text-brand-200">
                      {plugin.name}
                    </span>
                    <span className="font-mono text-xs text-ink-500 dark:text-ink-300">
                      {plugin.limit}
                    </span>
                  </Link>
                ))}
              </div>
              <p className="mt-5 text-sm text-ink-600 dark:text-ink-100">
                Core itself stays under 5.5 kB for a linear or graph journey, and the React linear
                bindings under 2.5 kB.{" "}
                <Link to="/docs/core/plugins/overview" className="font-semibold">
                  Read the plugin guide
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className={sectionHeading}>Watch a flow while it runs</h2>
              <p className={sectionLede}>
                Attach the bridge and the Chrome extension shows every machine on the page: an
                immutable snapshot inspector, a timeline with action, state, and diff views, and
                forms generated from the machine&apos;s own operations. Timeline selection is local
                to the panel — it never rewinds or mutates your running machine.
              </p>
              <div className="mt-8 overflow-hidden rounded-2xl border border-ink-300/80 shadow-[0_20px_44px_-28px_rgba(20,35,60,0.38)]">
                <img
                  src="/img/devtool/panel-overview.png"
                  alt="Journey DevTools panel showing a machine snapshot alongside its timeline"
                  className="block w-full"
                  loading="lazy"
                />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  className={`${ctaClasses} border border-ink-400/70 bg-white/80 text-ink-900 hover:border-ink-500 hover:bg-white dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:border-white/40 dark:hover:bg-white/16`}
                  href="https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm"
                >
                  Install the extension
                </Link>
                <Link
                  className={`${ctaClasses} border border-ink-400/70 bg-white/80 text-ink-900 hover:border-ink-500 hover:bg-white dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:border-white/40 dark:hover:bg-white/16`}
                  to="/docs/bridge/getting-started"
                >
                  Connect a machine
                </Link>
              </div>
            </section>

            <section>
              <h2 className={sectionHeading}>Keep reading</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card
                  title="Core: the headless engine"
                  body="Define steps, transitions, lifecycle, history, and persistence without UI assumptions."
                  href="/docs/core/getting-started"
                />
                <Card
                  title="React: the UI bindings"
                  body="Render active steps with typed linear bundles, graph bundles, or headless hooks."
                  href="/docs/react/overview"
                />
                <Card
                  title="Lifecycle"
                  body="Transition selection, terminal behavior, queue semantics, and the error lifecycle."
                  href="/docs/core/lifecycle"
                />
                <Card
                  title="Async"
                  body="Async guards, queued context updates, and loading and error UI around explicit phases."
                  href="/docs/core/async"
                />
                <Card
                  title="Patterns"
                  body="Practical structure for step components, controls, and machine ownership in React."
                  href="/docs/react/patterns"
                />
                <Card
                  title="Examples"
                  body="Complete flows you can adapt directly, from headless catalogs to full React journeys."
                  href="/docs/react/examples"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-ink-300/80 bg-white/90 px-8 py-12 text-center shadow-[0_20px_44px_-28px_rgba(20,35,60,0.38)] dark:border-ink-600/80 dark:bg-ink-800/50">
              <h2 className={sectionHeading}>Build your first flow in a few minutes</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-ink-600 dark:text-ink-100">
                Start with the React quickstart for a typed linear signup, or go straight to Core if
                you want the engine without the bindings.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  className={`${ctaClasses} bg-ink-900 text-white hover:bg-ink-800 dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100`}
                  to="/docs/react/quickstart"
                >
                  Get started
                </Link>
                <Link
                  className={`${ctaClasses} border border-ink-400/70 bg-white/80 text-ink-900 hover:border-ink-500 hover:bg-white dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:border-white/40 dark:hover:bg-white/16`}
                  href="https://github.com/rxova/journey"
                >
                  Star on GitHub
                </Link>
              </div>
            </section>
          </div>
        </section>
      </main>
    </Layout>
  );
}
