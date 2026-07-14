import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { createWizard, useWizard, useWizardStep, Wizard } from "@rxova/journey-react";
import type { JourneyStorage } from "@rxova/journey-core/persistence";

type Ctx = { email: string; attempts: number };

const initialContext: Ctx = { email: "", attempts: 0 };

const StepPanel = ({ label }: { label: string }) => {
  void useWizardStep; // steps may or may not intercept; this one renders only
  return <section data-testid="panel">{label}</section>;
};

const Email = (props: { id?: string }) => <StepPanel label="email" {...(void props, {})} />;
const Password = (props: { id?: string }) => <StepPanel label="password" {...(void props, {})} />;
const Confirm = (props: { id?: string }) => <StepPanel label="confirm" {...(void props, {})} />;

const Nav = () => {
  const { goToNextStep, goToPreviousStep, isFirstStep, isLastStep, activeStepId, isLoading } =
    useWizard<Ctx>();
  return (
    <nav>
      <output data-testid="active">{activeStepId}</output>
      <output data-testid="flags">
        {String(isFirstStep)}:{String(isLastStep)}:{String(isLoading)}
      </output>
      <button data-testid="back" disabled={isFirstStep} onClick={() => void goToPreviousStep()}>
        Back
      </button>
      <button data-testid="next" onClick={() => void goToNextStep()}>
        Next
      </button>
    </nav>
  );
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("<Wizard> — children form", () => {
  it("renders steps as bare children and navigates with useWizard", async () => {
    render(
      <Wizard context={initialContext} footer={<Nav />}>
        <Email id="email" />
        <Password id="password" />
        <Confirm id="confirm" />
      </Wizard>
    );
    await flush();

    expect(screen.getByTestId("panel").textContent).toBe("email");
    expect(screen.getByTestId("flags").textContent).toBe("true:false:false");

    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("panel").textContent).toBe("password");
    expect(screen.getByTestId("active").textContent).toBe("password");

    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("panel").textContent).toBe("confirm");
    expect(screen.getByTestId("flags").textContent).toBe("false:true:false");

    fireEvent.click(screen.getByTestId("back"));
    await flush();
    expect(screen.getByTestId("panel").textContent).toBe("password");
  });

  it("supports <Wizard.Step> wrappers mixed with id-prop children", async () => {
    const entered: string[] = [];
    render(
      <Wizard context={initialContext} footer={<Nav />}>
        <Wizard.Step
          id="email"
          meta={{ title: "Email" }}
          onEnter={() => void entered.push("email")}
        >
          <StepPanel label="email" />
        </Wizard.Step>
        <Password id="password" />
      </Wizard>
    );
    await flush();

    expect(screen.getByTestId("panel").textContent).toBe("email");
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("panel").textContent).toBe("password");
  });

  it("throws when a step child is missing its mandatory id", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() =>
      render(
        <Wizard context={initialContext}>
          <Email />
          <Password id="password" />
        </Wizard>
      )
    ).toThrowError(/mandatory unique "id" prop/);
    consoleError.mockRestore();
  });

  it("throws on duplicate ids and on children+steps both being set", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() =>
      render(
        <Wizard context={initialContext}>
          <Email id="same" />
          <Password id="same" />
        </Wizard>
      )
    ).toThrowError(/unique/);

    expect(() =>
      render(
        <Wizard context={initialContext} steps={{ email: Email }}>
          <Password id="password" />
        </Wizard>
      )
    ).toThrowError(/not both/);
    consoleError.mockRestore();
  });

  it("starts from startStepId when given", async () => {
    render(
      <Wizard context={initialContext} startStepId="password" footer={<Nav />}>
        <Email id="email" />
        <Password id="password" />
        <Confirm id="confirm" />
      </Wizard>
    );
    await flush();

    expect(screen.getByTestId("panel").textContent).toBe("password");
    // isFirstStep is position-based (index 1), matching react-use-wizard's
    // startIndex semantics; there is no back-history at a custom start, so
    // goToPreviousStep is a no-op.
    expect(screen.getByTestId("flags").textContent).toBe("false:false:false");
    fireEvent.click(screen.getByTestId("back"));
    await flush();
    expect(screen.getByTestId("panel").textContent).toBe("password");
  });
});

describe("<Wizard> — steps-object form", () => {
  it("uses object keys as ids and supports per-step config", async () => {
    const entered: string[] = [];
    render(
      <Wizard
        context={initialContext}
        footer={<Nav />}
        steps={{
          email: Email,
          password: {
            component: Password,
            meta: { title: "Password" },
            onEnter: () => void entered.push("password")
          }
        }}
      />
    );
    await flush();

    expect(screen.getByTestId("active").textContent).toBe("email");
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("password");
    expect(entered).toEqual(["password"]);
  });
});

describe("useWizard state surface", () => {
  it("exposes visited, isFirstTimeVisit, metadata, and shared typed context", async () => {
    const Probe = () => {
      const wizard = useWizard<Ctx>();
      return (
        <div>
          <output data-testid="visited">{JSON.stringify(wizard.visited)}</output>
          <output data-testid="firstVisit">{String(wizard.isFirstTimeVisit)}</output>
          <output data-testid="meta">{JSON.stringify(wizard.activeStepMeta ?? null)}</output>
          <output data-testid="email">{wizard.context.email}</output>
          <button
            data-testid="setEmail"
            onClick={() => void wizard.updateContext((ctx) => ({ ...ctx, email: "a@b.c" }))}
          >
            set
          </button>
          <button data-testid="next" onClick={() => void wizard.goToNextStep()}>
            next
          </button>
          <button data-testid="back" onClick={() => void wizard.goToPreviousStep()}>
            back
          </button>
        </div>
      );
    };

    render(
      <Wizard
        context={initialContext}
        header={<Probe />}
        steps={{
          email: { component: Email, meta: { title: "Email" } },
          password: Password
        }}
      />
    );
    await flush();

    expect(JSON.parse(screen.getByTestId("visited").textContent ?? "{}")).toEqual({
      email: true,
      password: false
    });
    expect(screen.getByTestId("firstVisit").textContent).toBe("true");
    expect(JSON.parse(screen.getByTestId("meta").textContent ?? "null")).toEqual({
      title: "Email"
    });

    fireEvent.click(screen.getByTestId("setEmail"));
    await flush();
    expect(screen.getByTestId("email").textContent).toBe("a@b.c");

    // Revisit email: no longer a first-time visit.
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    fireEvent.click(screen.getByTestId("back"));
    await flush();
    expect(screen.getByTestId("firstVisit").textContent).toBe("false");
  });

  it("exposes pauseJourney/resumeJourney with reactive isPaused", async () => {
    const Probe = () => {
      const { pauseJourney, resumeJourney, isPaused, goToNextStep, activeStepId } =
        useWizard<Ctx>();
      return (
        <div>
          <output data-testid="paused">{String(isPaused)}</output>
          <output data-testid="active">{activeStepId}</output>
          <button data-testid="pause" onClick={pauseJourney}>
            pause
          </button>
          <button data-testid="resume" onClick={resumeJourney}>
            resume
          </button>
          <button data-testid="next" onClick={() => void goToNextStep()}>
            next
          </button>
        </div>
      );
    };

    render(
      <Wizard
        context={initialContext}
        header={<Probe />}
        steps={{ email: Email, password: Password }}
      />
    );
    await flush();

    fireEvent.click(screen.getByTestId("pause"));
    await flush();
    expect(screen.getByTestId("paused").textContent).toBe("true");

    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("email");

    fireEvent.click(screen.getByTestId("resume"));
    await flush();
    expect(screen.getByTestId("paused").textContent).toBe("false");

    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("password");
  });
});

describe("useWizardStep", () => {
  it("awaits the handler before forward navigation and can update context", async () => {
    const handler = vi.fn(
      async ({ updateContext }: { updateContext: (u: (c: Ctx) => Ctx) => Promise<unknown> }) => {
        await updateContext((ctx) => ({ ...ctx, attempts: ctx.attempts + 1 }));
      }
    );

    const EmailWithHandler = () => {
      useWizardStep<Ctx>(handler as never);
      return <StepPanel label="email" />;
    };

    const Probe = () => {
      const { attempts } = useWizard<Ctx>().context;
      return <output data-testid="attempts">{attempts}</output>;
    };

    render(
      <Wizard
        context={initialContext}
        header={<Probe />}
        footer={<Nav />}
        steps={{ email: EmailWithHandler, password: Password }}
      />
    );
    await flush();

    fireEvent.click(screen.getByTestId("next"));
    await waitFor(() => {
      expect(screen.getByTestId("active").textContent).toBe("password");
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("attempts").textContent).toBe("1");
  });

  it("a rejecting handler cancels navigation and surfaces the error", async () => {
    const EmailBlocking = () => {
      useWizardStep<Ctx>(() => {
        throw new Error("validation failed");
      });
      return <StepPanel label="email" />;
    };

    const Probe = () => {
      const { error, activeStepId } = useWizard<Ctx>();
      return (
        <div>
          <output data-testid="active">{activeStepId}</output>
          <output data-testid="error">{error instanceof Error ? error.message : ""}</output>
        </div>
      );
    };

    const onError = vi.fn();
    const NextButton = () => {
      const { goToNextStep } = useWizard<Ctx>();
      return (
        <button data-testid="next" onClick={() => void goToNextStep()}>
          next
        </button>
      );
    };

    render(
      <Wizard
        context={initialContext}
        header={<Probe />}
        footer={<NextButton />}
        onError={onError}
        steps={{ email: EmailBlocking, password: Password }}
      />
    );
    await flush();

    fireEvent.click(screen.getByTestId("next"));
    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("validation failed");
    });
    expect(screen.getByTestId("active").textContent).toBe("email");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { phase: "step-handler" });
  });
});

describe("dynamic steps", () => {
  it("transplants state when a conditional step appears", async () => {
    const Host = () => {
      const [with2fa, setWith2fa] = React.useState(false);
      return (
        <div>
          <button data-testid="enable" onClick={() => setWith2fa(true)}>
            enable
          </button>
          <Wizard context={initialContext} footer={<Nav />}>
            <Email id="email" />
            {with2fa && <Password id="setup2fa" />}
            <Confirm id="confirm" />
          </Wizard>
        </div>
      );
    };

    render(<Host />);
    await flush();

    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("confirm");

    fireEvent.click(screen.getByTestId("enable"));
    await flush();

    // Active step survives the transplant; the new step is now in the order.
    expect(screen.getByTestId("active").textContent).toBe("confirm");
    fireEvent.click(screen.getByTestId("back"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("email");
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("setup2fa");
  });
});

describe("createWizard bundle", () => {
  it("gives fully typed hooks bound to the same runtime path", async () => {
    const bundle = createWizard({
      context: initialContext,
      steps: { email: Email, password: Password, confirm: Confirm }
    });

    const Probe = () => {
      const wizard = bundle.useWizard();
      // Type-level: wizard.context.email is a string, activeStepId is the key union.
      return (
        <div>
          <output data-testid="active">{wizard.activeStepId}</output>
          <output data-testid="count">{wizard.stepCount}</output>
          <button data-testid="next" onClick={() => void wizard.goToNextStep()}>
            next
          </button>
        </div>
      );
    };

    render(<bundle.Wizard header={<Probe />} />);
    await flush();

    expect(screen.getByTestId("active").textContent).toBe("email");
    expect(screen.getByTestId("count").textContent).toBe("3");
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("password");
  });

  it("toGraphDefinition emits the same step ids with a forward chain", () => {
    const bundle = createWizard({
      context: initialContext,
      steps: { email: Email, password: Password, confirm: Confirm }
    });

    const graph = bundle.toGraphDefinition();
    expect(graph.initial).toBe("email");
    expect(Object.keys(graph.steps)).toEqual(["email", "password", "confirm"]);
    expect(graph.transitions).toMatchObject({
      email: { goToNextStep: [{ to: "password" }] },
      password: { goToNextStep: [{ to: "confirm" }] }
    });
  });
});

describe("StrictMode & lifecycle", () => {
  it("creates exactly one machine under StrictMode and completes on last-step next", async () => {
    const onComplete = vi.fn();

    render(
      <React.StrictMode>
        <Wizard context={initialContext} footer={<Nav />} onComplete={onComplete}>
          <Email id="email" />
          <Password id="password" />
        </Wizard>
      </React.StrictMode>
    );
    await flush();

    fireEvent.click(screen.getByTestId("next"));
    await flush();
    fireEvent.click(screen.getByTestId("next"));
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
    expect(onComplete.mock.calls[0]?.[0]?.snapshot?.type).toBe("linear");
  });

  it("fires onStepChange with direction and indices", async () => {
    const onStepChange = vi.fn();

    render(
      <Wizard context={initialContext} footer={<Nav />} onStepChange={onStepChange}>
        <Email id="email" />
        <Password id="password" />
      </Wizard>
    );
    await flush();

    fireEvent.click(screen.getByTestId("next"));
    await flush();

    expect(onStepChange).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStepId: "email",
        toStepId: "password",
        fromIndex: 0,
        toIndex: 1,
        direction: "forward"
      })
    );
  });
});

describe("persistence sugar", () => {
  const createMemoryStorage = () => {
    const store = new Map<string, string>();
    const storage: JourneyStorage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key)
    };
    return { store, storage };
  };

  it("restores progress from storage and stores the linear discriminator", async () => {
    const { store, storage } = createMemoryStorage();

    const { unmount } = render(
      <Wizard context={initialContext} persist={{ key: "wiz", storage }} footer={<Nav />}>
        <Email id="email" />
        <Password id="password" />
        <Confirm id="confirm" />
      </Wizard>
    );
    await flush();
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("password");
    unmount();
    await flush();

    const persisted = JSON.parse(store.get("wiz") ?? "{}") as {
      snapshot: { type?: string; currentStepId?: string };
    };
    expect(persisted.snapshot.type).toBe("linear");
    expect(persisted.snapshot.currentStepId).toBe("password");

    render(
      <Wizard context={initialContext} persist={{ key: "wiz", storage }} footer={<Nav />}>
        <Email id="email" />
        <Password id="password" />
        <Confirm id="confirm" />
      </Wizard>
    );
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("password");
  });
});
