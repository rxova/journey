import { withGraphTypes, type GraphDefinition } from "@rxova/journey-core";
import "./styles/quickstart.css";

// A graph journey in one screen: declare types, define steps, create the
// machine, subscribe, send. The full feature tour lives in core-showcase-graph.

// ── 1. Types ─────────────────────────────────────────────────────────────────
type CheckoutStepId = "cart" | "receipt";
type CheckoutContext = { items: number; error: string | null };
type CheckoutEvent = { type: "checkout" };

// The bag pins what the definition cannot infer on its own — here the result
// type of the `checkout` work, which sits at a property position.
type CheckoutBag = {
  context: CheckoutContext;
  stepId: CheckoutStepId;
  events: CheckoutEvent;
  results: { checkout: { charged: boolean } };
};

// ── 2. Definition ────────────────────────────────────────────────────────────
const chargeApi = async (items: number) => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { charged: items > 0 };
};

const definition = {
  initial: "cart",
  context: { items: 0, error: null },
  steps: {
    cart: {
      on: {
        // `checkout` names an intent, not an outcome. The work calls the API,
        // `commit` stages what came back, and the candidates route on that
        // staged context — first enabled wins. The unguarded last candidate
        // keeps the event total: a failed charge still routes (back here), so
        // its error commits instead of being rolled back.
        checkout: {
          run: ({ snapshot }) => chargeApi(snapshot.context.items),
          commit: ({ result, updateContext }) =>
            updateContext((context) => ({
              ...context,
              error: result.charged ? null : "Your cart is empty."
            })),
          candidates: [
            { to: "receipt", when: ({ context }) => context.error === null },
            { to: "cart" }
          ]
        }
      }
    },
    // Terminal step: no outgoing transitions. Arriving here does NOT complete
    // the journey — completion is an explicit outcome, declared below via
    // controls.
    receipt: {}
  }
} satisfies GraphDefinition<CheckoutBag>;

// ── 3. Machine ───────────────────────────────────────────────────────────────
const machine = withGraphTypes<CheckoutBag>()(definition);

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

machine.subscriptions.subscribe(() => render());
render();
