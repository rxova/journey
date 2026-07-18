import { createGraphJourney, createGraphJourneyBuilder } from "@rxova/journey-core";
import "./styles/quickstart.css";

// A graph journey in one screen: declare types, define steps, create the
// machine, subscribe, send. The full feature tour lives in core-showcase-graph.

// ── 1. Types ─────────────────────────────────────────────────────────────────
type CheckoutStepId = "cart" | "receipt";
type CheckoutContext = { items: number; paid: boolean; error: string | null };
type CheckoutEvent = { type: "checkout" };

const { createStep, build } = createGraphJourneyBuilder<{
  context: CheckoutContext;
  stepId: CheckoutStepId;
  events: CheckoutEvent;
}>();

// ── 2. Definition ────────────────────────────────────────────────────────────
const chargeApi = async (items: number) => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { charged: items > 0 };
};

const cartStep = createStep("cart", {
  on: {
    // `checkout` names an intent, not an outcome. The work calls the API,
    // `commit` stages what came back, and the candidates route on the staged
    // context — first enabled wins. The unguarded `to("cart")` keeps the event
    // total: a failed charge still routes (back here), so its error commits
    // instead of being rolled back with the unmatched send.
    checkout: ({ to, work }) =>
      work({
        run: ({ snapshot }) => chargeApi(snapshot.context.items),
        commit: ({ result, updateContext }) =>
          updateContext((context) => ({
            ...context,
            paid: result.charged,
            error: result.charged ? null : "Your cart is empty."
          })),
        candidates: [to("receipt").when(({ context }) => context.paid), to("cart")]
      })
  }
});

// Terminal step: no outgoing transitions. Arriving here does NOT complete the
// journey — completion is an explicit outcome, declared below via controls.
const receiptStep = createStep("receipt", {});

const definition = build({
  initial: "cart",
  context: { items: 0, paid: false, error: null },
  steps: [cartStep, receiptStep]
});

// ── 3. Machine ───────────────────────────────────────────────────────────────
const machine = createGraphJourney(definition, { autoStart: true });

// ── 4. Render from the snapshot ──────────────────────────────────────────────
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

const render = () => {
  const snapshot = machine.getSnapshot();
  const { context, status } = snapshot;
  const busy = snapshot.machine.isLoading;

  root.innerHTML =
    snapshot.currentStep?.id === "receipt"
      ? `<main class="card">
          <h1>Receipt</h1>
          <p>Paid for ${context.items} item(s) — journey status: <strong>${status}</strong></p>
          <button data-action="complete" ${status !== "running" ? "disabled" : ""}>
            ${status === "completed" ? "Completed ✓" : "Complete journey"}
          </button>
          <button data-action="restart">Start over</button>
        </main>`
      : `<main class="card">
          <h1>Cart</h1>
          <p>${context.items} item(s)</p>
          ${context.error ? `<p class="error">${context.error}</p>` : ""}
          <button data-action="add" ${busy ? "disabled" : ""}>Add item</button>
          <button data-action="checkout" ${busy ? "disabled" : ""}>
            ${busy ? "Charging…" : "Checkout"}
          </button>
        </main>`;
};

// ── 5. Wire intents ──────────────────────────────────────────────────────────
root.addEventListener("click", (event) => {
  const action = event.target instanceof HTMLElement ? event.target.dataset.action : undefined;
  if (action === "add") {
    machine.context.update((context) => ({ ...context, items: context.items + 1, error: null }));
  }
  // The call site never picks the destination — the definition's guards do.
  if (action === "checkout") void machine.send("checkout");
  if (action === "complete") machine.controls.complete();
  if (action === "restart") {
    if (machine.getSnapshot().status === "running") machine.controls.terminate();
    machine.controls.restart();
  }
});

machine.subscriptions.subscribeSelector(
  (snapshot) => snapshot,
  () => render()
);
render();
