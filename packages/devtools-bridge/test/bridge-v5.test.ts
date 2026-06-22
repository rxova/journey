import { afterEach, describe, expect, it, vi } from "vitest";

import * as journeyCore from "@rxova/journey-core";
import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import {
  getJourneyMachineDevtoolsRegistry,
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  attachJourneyDevtools
} from "@rxova/journey-devtools-bridge";

import { resolveNonProductionEnvironment } from "../src/bridge";

import {
  buildInvokeEnvelope,
  collectBridgeMessages,
  createTestMachine,
  waitForCollector,
  waitForMessages
} from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("attachJourneyDevtools v5", () => {
  it("resolves non-production environments from bundler and node fallbacks", () => {
    expect(
      resolveNonProductionEnvironment({ bundlerEnv: { DEV: true }, nodeEnv: "production" })
    ).toBe(true);
    expect(
      resolveNonProductionEnvironment({ bundlerEnv: { PROD: true }, nodeEnv: "development" })
    ).toBe(false);
    expect(resolveNonProductionEnvironment({ bundlerEnv: null, nodeEnv: "development" })).toBe(
      true
    );
    expect(resolveNonProductionEnvironment({ bundlerEnv: {}, nodeEnv: "production" })).toBe(false);
    expect(
      resolveNonProductionEnvironment({ bundlerEnv: "dev" as never, nodeEnv: undefined })
    ).toBe(false);
    expect(resolveNonProductionEnvironment({ bundlerEnv: null, nodeEnv: undefined })).toBe(false);
  });

  it("uses fallback document metadata when app name is unavailable", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine();
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: undefined
    });

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-no-document",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-no-document"
      )
    );

    const register = collector.messages.find(
      (message) => message.kind === "register" && message.machineId === "m-no-document"
    );
    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.meta.appName).toBeNull();
    }

    detach();
    collector.stop();
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument
    });
  });

  it("uses wildcard target origin and accepts null-origin extension messages", async () => {
    const machine = await createTestMachine();
    const listeners: ((event: MessageEvent<unknown>) => void)[] = [];
    const postMessage = vi.fn();
    const originalWindow = globalThis.window;
    const fakeWindow = {
      location: { origin: "null" },
      postMessage,
      addEventListener: vi.fn((type: string, listener: (event: MessageEvent<unknown>) => void) => {
        if (type === "message") {
          listeners.push(listener);
        }
      }),
      removeEventListener: vi.fn()
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: fakeWindow
    });

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-null-origin",
      enabled: true
    });

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: "register" }), "*");
    const listener = listeners[0];
    if (!listener) {
      throw new Error("missing bridge listener");
    }

    listener({
      source: fakeWindow,
      origin: "",
      data: buildInvokeEnvelope("m-null-origin", "req-empty-origin", {
        operationId: "core.goToNextStep"
      }).data
    } as MessageEvent<unknown>);
    listener({
      source: fakeWindow,
      origin: "null",
      data: buildInvokeEnvelope("m-null-origin", "req-null-origin", {
        operationId: "core.goToNextStep"
      }).data
    } as MessageEvent<unknown>);

    await waitForMessages();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "operationResult",
        requestId: "req-null-origin"
      }),
      "*"
    );
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-empty-origin"
      }),
      "*"
    );

    detach();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
  });

  it("registers generic features, handles invokes, and unregisters", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-1",
      label: "Checkout",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-1"
      )
    );

    const register = collector.messages.find(
      (message) => message.kind === "register" && message.machineId === "m-1"
    );

    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.meta.label).toBe("Checkout");
      expect(register.meta.mode).toBe("graph");
      expect(register.meta.eventTypesBySource).toEqual({});
      expect(register.meta.goToStepTargetsBySource).toEqual({});
      expect(register.meta.features.map((feature) => feature.id)).toEqual([
        "core",
        "execution-paths"
      ]);
    }

    window.dispatchEvent(
      buildInvokeEnvelope("m-1", "req-paths", {
        operationId: "execution-paths.inspect",
        input: { maxDepth: 3, maxPaths: 10 }
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-1", "req-next", {
        operationId: "core.goToNextStep"
      })
    );

    await waitForCollector(
      () =>
        collector.messages.some(
          (message) => message.kind === "operationResult" && message.requestId === "req-paths"
        ) &&
        collector.messages.some(
          (message) => message.kind === "operationResult" && message.requestId === "req-next"
        )
    );

    const pathsResult = collector.messages.find(
      (message) => message.kind === "operationResult" && message.requestId === "req-paths"
    );
    expect(pathsResult?.kind).toBe("operationResult");
    if (pathsResult?.kind === "operationResult") {
      expect(pathsResult.operationId).toBe("execution-paths.inspect");
      expect(pathsResult.result.kind).toBe("data");
    }

    const nextResult = collector.messages.find(
      (message) => message.kind === "operationResult" && message.requestId === "req-next"
    );
    expect(nextResult?.kind).toBe("operationResult");
    if (nextResult?.kind === "operationResult" && nextResult.result.kind === "snapshot") {
      expect(nextResult.operationId).toBe("core.goToNextStep");
      expect(nextResult.result.snapshot.currentStepId).toBe("review");
      expect(nextResult.result.transitionId).toEqual(expect.any(String));
    }

    detach();
    await waitForMessages();

    expect(collector.messages.at(-1)?.kind).toBe("unregister");
    collector.stop();
  });

  it("blocks mutating operations when disabled but allows queries", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-2",
      enabled: true,
      commandsEnabled: false
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-2"
      )
    );

    window.dispatchEvent(
      buildInvokeEnvelope("m-2", "req-disabled", {
        operationId: "core.goToNextStep"
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-2", "req-query", {
        operationId: "execution-paths.inspect"
      })
    );

    await waitForCollector(
      () =>
        collector.messages.some(
          (message) => message.kind === "operationError" && message.requestId === "req-disabled"
        ) &&
        collector.messages.some(
          (message) => message.kind === "operationResult" && message.requestId === "req-query"
        )
    );

    const disabledError = collector.messages.find(
      (message) => message.kind === "operationError" && message.requestId === "req-disabled"
    );
    expect(disabledError?.kind).toBe("operationError");
    if (disabledError?.kind === "operationError") {
      expect(disabledError.error.message).toContain("disabled");
    }

    const queryResult = collector.messages.find(
      (message) => message.kind === "operationResult" && message.requestId === "req-query"
    );
    expect(queryResult?.kind).toBe("operationResult");
    if (queryResult?.kind === "operationResult") {
      expect(queryResult.operationId).toBe("execution-paths.inspect");
      expect(queryResult.result.kind).toBe("data");
    }

    detach();
    collector.stop();
  });

  it("supports context updates and forced transitions", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-3",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-3"
      )
    );

    window.dispatchEvent(
      buildInvokeEnvelope("m-3", "req-replace-context", {
        operationId: "core.updateContext",
        input: { context: { count: 5 } }
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-3", "req-patch-context", {
        operationId: "core.patchContext",
        input: { key: "count", value: 9 }
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-3", "req-force-step", {
        operationId: "core.forceStepTransition",
        input: { stepId: "review" }
      })
    );

    await waitForCollector(
      () =>
        collector.messages.some(
          (message) =>
            message.kind === "operationResult" && message.requestId === "req-replace-context"
        ) &&
        collector.messages.some(
          (message) =>
            message.kind === "operationResult" && message.requestId === "req-patch-context"
        ) &&
        collector.messages.some(
          (message) => message.kind === "operationResult" && message.requestId === "req-force-step"
        )
    );

    const replaceContextResult = collector.messages.find(
      (message) => message.kind === "operationResult" && message.requestId === "req-replace-context"
    );
    expect(replaceContextResult?.kind).toBe("operationResult");
    if (
      replaceContextResult?.kind === "operationResult" &&
      replaceContextResult.result.kind === "snapshot"
    ) {
      expect(replaceContextResult.operationId).toBe("core.updateContext");
      expect(replaceContextResult.result.snapshot.context).toEqual({ count: 5 });
    }

    const patchContextResult = collector.messages.find(
      (message) => message.kind === "operationResult" && message.requestId === "req-patch-context"
    );
    expect(patchContextResult?.kind).toBe("operationResult");
    if (
      patchContextResult?.kind === "operationResult" &&
      patchContextResult.result.kind === "snapshot"
    ) {
      expect(patchContextResult.operationId).toBe("core.patchContext");
      expect(patchContextResult.result.snapshot.context).toEqual({ count: 9 });
    }

    const forceStepResult = collector.messages.find(
      (message) => message.kind === "operationResult" && message.requestId === "req-force-step"
    );
    expect(forceStepResult?.kind).toBe("operationResult");
    if (forceStepResult?.kind === "operationResult" && forceStepResult.result.kind === "snapshot") {
      expect(forceStepResult.operationId).toBe("core.forceStepTransition");
      expect(forceStepResult.result.snapshot.currentStepId).toBe("review");
      expect(forceStepResult.result.transitioned).toBe(true);
      expect(forceStepResult.result.transitionId).toBe("devtools.forceStep");
    }

    detach();
    collector.stop();
  });

  it("derives graph metadata for custom events and goToStepById targets", async () => {
    type StepId = "start" | "emailCode" | "authenticatorCode";
    type Context = { count: number };
    type EventMap = { type: "submitLogin"; payload?: { channel: "email" | "authenticator" } };

    const journey: JourneyDefinition<Context, StepId, EventMap> = {
      initial: "start",
      context: { count: 0 },
      steps: {
        start: {},
        emailCode: {},
        authenticatorCode: {}
      },
      transitions: {
        start: {
          submitLogin: [{ to: "emailCode" }, { to: "authenticatorCode" }],
          goToStepById: [{ to: "authenticatorCode" }]
        }
      }
    };

    const machine = createJourneyMachine(journey, {
      plugins: [createExecutionPathsPlugin()] as const
    });
    await machine.startJourney();

    const collector = collectBridgeMessages();
    const detach = attachJourneyDevtools(machine, {
      machineId: "m-meta",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-meta"
      )
    );

    const register = collector.messages.find(
      (message) => message.kind === "register" && message.machineId === "m-meta"
    );
    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.meta.stepIds).toEqual(["start", "emailCode", "authenticatorCode"]);
      expect(register.meta.eventTypes).toEqual(["submitLogin"]);
      expect(register.meta.eventTypesBySource).toEqual({ start: ["submitLogin"] });
      expect(register.meta.goToStepTargetsBySource).toEqual({
        start: ["authenticatorCode"]
      });
    }

    detach();
    collector.stop();
  });

  it("registers linear and headless journey modes with default metadata", async () => {
    document.title = "Document App";

    const linearCollector = collectBridgeMessages();
    const linearMachine = createJourneyMachine({
      context: { count: 0 },
      steps: {
        start: {},
        review: {}
      },
      transitions: ["start", "review"] as const
    });
    const detachLinear = attachJourneyDevtools(linearMachine, {
      enabled: true,
      commandsEnabled: true
    });
    await waitForCollector(() =>
      linearCollector.messages.some((message) => message.kind === "register")
    );
    const linearRegister = linearCollector.messages.find((message) => message.kind === "register");
    expect(linearRegister?.kind).toBe("register");
    if (linearRegister?.kind === "register") {
      expect(linearRegister.meta.mode).toBe("linear");
      expect(linearRegister.meta.label).toBe("Journey Machine");
      expect(linearRegister.meta.appName).toBe("Document App");
      expect(linearRegister.meta.mutationsEnabled).toBe(true);
      expect(linearRegister.machineId).toMatch(/^journey-/);
    }
    detachLinear();
    linearCollector.stop();

    const headlessCollector = collectBridgeMessages();
    const headlessMachine = createJourneyMachine({
      initial: "start",
      context: { count: 0 },
      steps: {
        start: {},
        review: {}
      }
    });
    const detachHeadless = attachJourneyDevtools(headlessMachine, {
      machineId: "m-headless",
      enabled: true,
      mutationsEnabled: false
    });
    await waitForCollector(() =>
      headlessCollector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-headless"
      )
    );
    const headlessRegister = headlessCollector.messages.find(
      (message) => message.kind === "register" && message.machineId === "m-headless"
    );
    expect(headlessRegister?.kind).toBe("register");
    if (headlessRegister?.kind === "register") {
      expect(headlessRegister.meta.mode).toBe("headless");
      expect(headlessRegister.meta.mutationsEnabled).toBe(false);
    }
    detachHeadless();
    headlessCollector.stop();
  });

  it("replays register and snapshot on replay requests and ignores foreign messages", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine();
    const detach = attachJourneyDevtools(machine, {
      machineId: "m-replay",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-replay"
      )
    );
    const baselineCount = collector.messages.length;

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: { type: "__RXOVA_JOURNEY_DEVTOOLS_REPLAY_REQUEST__" }
      })
    );
    await waitForCollector(() => collector.messages.length >= baselineCount + 2);
    expect(collector.messages.at(-2)?.kind).toBe("register");
    expect(collector.messages.at(-1)?.kind).toBe("snapshot");

    const ignoredCount = collector.messages.length;
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: "https://evil.example",
        data: {
          channel: "__RXOVA_JOURNEY_DEVTOOLS__",
          version: 5,
          source: "rxova-journey-extension",
          kind: "invoke",
          machineId: "m-replay",
          requestId: "req-ignored",
          invocation: { operationId: "core.goToNextStep" },
          timestamp: Date.now()
        }
      })
    );
    await waitForMessages();
    expect(collector.messages).toHaveLength(ignoredCount);

    detach();
    collector.stop();
  });

  it("reports unknown operations, thrown operation errors, and rate limits", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine();
    const detach = attachJourneyDevtools(machine, {
      machineId: "m-errors",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-errors"
      )
    );

    window.dispatchEvent(
      buildInvokeEnvelope("m-errors", "req-unknown", {
        operationId: "core.notReal"
      })
    );
    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "operationError" && message.requestId === "req-unknown"
      )
    );
    const unknownError = collector.messages.find(
      (message) => message.kind === "operationError" && message.requestId === "req-unknown"
    );
    expect(unknownError?.kind).toBe("operationError");
    if (unknownError?.kind === "operationError") {
      expect(unknownError.error.message).toContain('Unknown operation "core.notReal"');
    }

    (machine as typeof machine & { goToNextStep: () => Promise<never> }).goToNextStep =
      async () => {
        throw new Error("bridge boom");
      };
    window.dispatchEvent(
      buildInvokeEnvelope("m-errors", "req-throw", {
        operationId: "core.goToNextStep"
      })
    );
    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "operationError" && message.requestId === "req-throw"
      )
    );
    const thrownError = collector.messages.find(
      (message) => message.kind === "operationError" && message.requestId === "req-throw"
    );
    expect(thrownError?.kind).toBe("operationError");
    if (thrownError?.kind === "operationError") {
      expect(thrownError.error.message).toBe("bridge boom");
    }

    (machine as typeof machine & { goToPreviousStep: () => Promise<never> }).goToPreviousStep =
      async () => {
        throw "plain string error";
      };
    window.dispatchEvent(
      buildInvokeEnvelope("m-errors", "req-string", {
        operationId: "core.goToPreviousStep"
      })
    );
    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "operationError" && message.requestId === "req-string"
      )
    );
    const stringError = collector.messages.find(
      (message) => message.kind === "operationError" && message.requestId === "req-string"
    );
    expect(stringError?.kind).toBe("operationError");
    if (stringError?.kind === "operationError") {
      expect(stringError.error.message).toBe("plain string error");
    }

    for (let index = 0; index < 101; index += 1) {
      window.dispatchEvent(
        buildInvokeEnvelope("m-errors", `req-rate-${index}`, {
          operationId: "core.notReal"
        })
      );
    }
    await waitForCollector(() =>
      collector.messages.some(
        (message) =>
          message.kind === "operationError" &&
          message.requestId === "req-rate-100" &&
          message.error.message.includes("rate limit")
      )
    );

    detach();
    collector.stop();
  });

  it("serializes non-JSON-safe snapshots and observations for transport", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine({ withExecutionPaths: false });

    (
      machine as typeof machine & {
        getSnapshot: typeof machine.getSnapshot;
      }
    ).getSnapshot = () =>
      ({
        currentStepId: "start",
        history: { timeline: ["start"], index: 0 },
        context: {
          count: 1n,
          helper() {
            return "formatted";
          },
          nested: {
            token: Symbol("devtools")
          }
        },
        visited: { start: true },
        status: "running",
        async: {
          isLoading: true,
          byStep: {
            start: {
              phase: "error",
              eventType: "goToNextStep",
              transitionId: "t-1",
              error: {
                createdAt: new Date("2026-03-07T08:05:00.000Z"),
                retry() {
                  return "retry";
                }
              }
            }
          }
        }
      }) as Parameters<typeof attachJourneyDevtools>[0]["getSnapshot"] extends () => infer T
        ? T
        : never;

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-serialize",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-serialize"
      )
    );

    const register = collector.messages.find(
      (message) => message.kind === "register" && message.machineId === "m-serialize"
    );
    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.snapshot.context).toEqual({
        count: "1",
        helper: "[Function helper]",
        nested: {
          token: "Symbol(devtools)"
        }
      });
      expect(register.snapshot.async.byStep.start?.error).toEqual({
        createdAt: "2026-03-07T08:05:00.000Z",
        retry: "[Function retry]"
      });
    }

    await machine.resetJourney();
    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "observation" && message.machineId === "m-serialize"
      )
    );
    expect(
      collector.messages.some(
        (message) => message.kind === "observation" && message.machineId === "m-serialize"
      )
    ).toBe(true);

    detach();
    collector.stop();
  });

  it("ignores invoke envelopes for the wrong source, kind, machine, or origin", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine();
    const detach = attachJourneyDevtools(machine, {
      machineId: "m-ignore",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-ignore"
      )
    );
    const baselineCount = collector.messages.length;

    const invalidEvents = [
      new MessageEvent("message", {
        source: window,
        origin: "https://evil.example",
        data: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
          source: "rxova-journey-extension",
          kind: "invoke",
          machineId: "m-ignore",
          requestId: "req-1",
          invocation: { operationId: "core.goToNextStep" },
          timestamp: Date.now()
        }
      }),
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
          source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
          kind: "invoke",
          machineId: "m-ignore",
          requestId: "req-2",
          invocation: { operationId: "core.goToNextStep" },
          timestamp: Date.now()
        }
      }),
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
          source: "rxova-journey-extension",
          kind: "invoke",
          machineId: "other-machine",
          requestId: "req-3",
          invocation: { operationId: "core.goToNextStep" },
          timestamp: Date.now()
        }
      })
    ];

    for (const event of invalidEvents) {
      window.dispatchEvent(event);
    }
    await waitForMessages();
    expect(collector.messages).toHaveLength(baselineCount);

    detach();
    collector.stop();
  });

  it("supports the remaining core operations and trims default metadata", async () => {
    type StepId = "start" | "review";
    type Context = { count: number };
    type EventMap = { type: "custom"; payload?: { amount: number } };

    const journey: JourneyDefinition<Context, StepId, EventMap> = {
      initial: "start",
      context: { count: 0 },
      steps: {
        start: {},
        review: {}
      },
      transitions: {
        start: {
          custom: [{ to: "review" }],
          goToStepById: [{ to: "review" }]
        }
      }
    };

    const machine = createJourneyMachine(journey, {
      plugins: [createExecutionPathsPlugin()] as const
    });
    const clearStepErrorSpy = vi
      .spyOn(machine, "clearStepError")
      .mockImplementation(async () => machine.getSnapshot());

    const collector = collectBridgeMessages();
    const detach = attachJourneyDevtools(machine, {
      machineId: "  machine-trimmed  ",
      label: "  Trimmed Label  ",
      appName: "  App Title  ",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "machine-trimmed"
      )
    );

    const register = collector.messages.find(
      (message) => message.kind === "register" && message.machineId === "machine-trimmed"
    );
    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.meta.label).toBe("Trimmed Label");
      expect(register.meta.appName).toBe("App Title");
    }

    const operations = [
      { requestId: "req-start", invocation: { operationId: "core.startJourney" } },
      {
        requestId: "req-send",
        invocation: {
          operationId: "core.sendEvent",
          input: { type: "custom", payload: { amount: 2 } }
        }
      },
      {
        requestId: "req-previous",
        invocation: { operationId: "core.goToPreviousStep", input: { steps: 1 } }
      },
      { requestId: "req-last", invocation: { operationId: "core.goToLastVisitedStep" } },
      { requestId: "req-complete", invocation: { operationId: "core.completeJourney" } },
      { requestId: "req-terminate", invocation: { operationId: "core.terminateJourney" } },
      { requestId: "req-reset", invocation: { operationId: "core.resetJourney" } },
      {
        requestId: "req-clear",
        invocation: { operationId: "core.clearStepError", input: { stepId: "review" } }
      }
    ] as const;

    for (const operation of operations) {
      window.dispatchEvent(
        buildInvokeEnvelope("machine-trimmed", operation.requestId, operation.invocation)
      );
    }

    await waitForCollector(() =>
      operations.every((operation) =>
        collector.messages.some(
          (message) =>
            (message.kind === "operationResult" || message.kind === "operationError") &&
            message.requestId === operation.requestId
        )
      )
    );

    expect(clearStepErrorSpy).toHaveBeenCalledWith("review");
    expect(
      collector.messages.some(
        (message) =>
          message.kind === "operationResult" &&
          message.requestId === "req-send" &&
          message.operationId === "core.sendEvent"
      )
    ).toBe(true);
    expect(
      collector.messages.some(
        (message) =>
          message.kind === "operationResult" &&
          message.requestId === "req-reset" &&
          message.operationId === "core.resetJourney"
      )
    ).toBe(true);

    detach();
    collector.stop();
  });

  it("covers fallback core operations and malformed async snapshot serialization", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine({
      withExecutionPaths: false,
      journey: {
        initial: "start",
        context: { count: 0 },
        steps: {
          start: {},
          review: {}
        },
        transitions: {
          start: {
            goToStepById: [{ to: "review" }],
            custom: [{ to: "review" }]
          }
        }
      }
    });
    const registry = getJourneyMachineDevtoolsRegistry(machine);
    if (!registry) {
      throw new Error("expected devtools registry");
    }
    (registry as typeof registry & { controls: undefined }).controls = undefined;
    (machine as typeof machine & { getSnapshot: typeof machine.getSnapshot }).getSnapshot = () =>
      ({
        currentStepId: "start",
        history: { timeline: ["start"], index: 0 },
        context: { count: 0 },
        visited: { start: true, review: false },
        status: "running",
        async: {
          isLoading: false,
          byStep: {
            start: null,
            review: {
              phase: "unexpected",
              eventType: 42,
              transitionId: false,
              error: null
            }
          }
        }
      }) as ReturnType<typeof machine.getSnapshot>;

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-fallback",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-fallback"
      )
    );

    const register = collector.messages.find(
      (message) => message.kind === "register" && message.machineId === "m-fallback"
    );
    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.snapshot.async.byStep.start).toBeUndefined();
      expect(register.snapshot.async.byStep.review).toMatchObject({
        phase: "idle",
        eventType: null,
        transitionId: null,
        error: null
      });
    }

    const operations = [
      {
        requestId: "req-direct-step",
        invocation: { operationId: "core.goToStepById", input: { stepId: "review" } }
      },
      {
        requestId: "req-force-fallback",
        invocation: { operationId: "core.forceStepTransition", input: { stepId: "review" } }
      },
      { requestId: "req-prev-default", invocation: { operationId: "core.goToPreviousStep" } },
      {
        requestId: "req-send-empty",
        invocation: { operationId: "core.sendEvent", input: { type: "custom" } }
      },
      { requestId: "req-clear-current", invocation: { operationId: "core.clearStepError" } }
    ] as const;

    for (const operation of operations) {
      window.dispatchEvent(
        buildInvokeEnvelope("m-fallback", operation.requestId, operation.invocation)
      );
    }
    window.dispatchEvent(
      buildInvokeEnvelope("m-fallback", "req-send-default", { operationId: "core.sendEvent" })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-fallback", "req-replace-default", {
        operationId: "core.updateContext"
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-fallback", "req-patch-default", { operationId: "core.patchContext" })
    );

    await waitForCollector(() =>
      operations.every((operation) =>
        collector.messages.some(
          (message) =>
            message.kind === "operationResult" && message.requestId === operation.requestId
        )
      )
    );

    expect(
      collector.messages.some(
        (message) =>
          message.kind === "operationResult" &&
          message.requestId === "req-force-fallback" &&
          message.operationId === "core.forceStepTransition"
      )
    ).toBe(true);

    detach();
    collector.stop();
  });

  it("returns a noop detach when disabled and throws when the devtools registry is missing", async () => {
    const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => {});
    const machine = await createTestMachine();

    const disabledDetach = attachJourneyDevtools(machine, { enabled: false });
    disabledDetach();
    expect(postMessageSpy).not.toHaveBeenCalled();
    postMessageSpy.mockClear();

    const defaultDetach = attachJourneyDevtools(machine);
    defaultDetach();
    expect(postMessageSpy).toHaveBeenCalled();
    postMessageSpy.mockClear();

    const registrySpy = vi
      .spyOn(journeyCore, "getJourneyMachineDevtoolsRegistry")
      .mockReturnValue(undefined as never);

    expect(() => attachJourneyDevtools(machine, { enabled: true })).toThrow(
      "Journey machine is missing devtools registry."
    );
    registrySpy.mockRestore();
  });

  it("does not throw into the host app when window.postMessage fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => {
      throw new Error("postMessage blocked");
    });

    const machine = await createTestMachine();

    // attach → register emission must not throw.
    let detach: (() => void) | undefined;
    expect(() => {
      detach = attachJourneyDevtools(machine, { machineId: "m-throwing", enabled: true });
    }).not.toThrow();

    // snapshot emission on a real transition must not throw, and the machine
    // must still commit the transition.
    await expect(machine.send({ type: "goToNextStep" })).resolves.toBeDefined();
    expect(machine.getSnapshot().currentStepId).toBe("review");

    // an incoming operation invocation → result/error emission must not throw.
    expect(() =>
      window.dispatchEvent(
        buildInvokeEnvelope("m-throwing", "req-throwing", {
          operationId: "core.goToNextStep",
          fields: {}
        })
      )
    ).not.toThrow();
    await waitForMessages();

    // detach → unregister emission must not throw.
    expect(() => detach?.()).not.toThrow();

    // The guard was actually exercised.
    expect(postMessageSpy).toHaveBeenCalled();
  });

  it("supports custom text, data, void, and non-json operation results from the machine registry", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine();
    const registry = getJourneyMachineDevtoolsRegistry(machine);
    if (!registry) {
      throw new Error("expected devtools registry");
    }

    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    const originalStructuredClone = globalThis.structuredClone;
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      value: undefined
    });

    (registry as typeof registry & { features: unknown[] }).features = [
      ...registry.features,
      {
        id: "custom",
        label: "Custom",
        operations: [
          {
            id: "custom.describe",
            label: "describe",
            mutates: false,
            output: "text",
            run: async () => ({ kind: "text", text: "described" })
          },
          {
            id: "custom.inspect",
            label: "inspect",
            mutates: false,
            output: "data",
            run: async () => ({ kind: "data", data: { branch: "covered" } })
          },
          {
            id: "custom.circular",
            label: "circular",
            mutates: false,
            output: "data",
            run: async () => ({ kind: "data", data: circular })
          },
          {
            id: "custom.throwing-json",
            label: "throwing json",
            mutates: false,
            output: "data",
            run: async () => ({
              kind: "data",
              data: {
                toJSON: () => {
                  throw new Error("cannot stringify");
                }
              }
            })
          },
          {
            id: "custom.function",
            label: "undefined data",
            mutates: false,
            output: "data",
            run: async () => ({ kind: "data", data: undefined })
          },
          {
            id: "custom.flush",
            label: "flush",
            mutates: false,
            output: "void",
            run: async () => ({ kind: "void" })
          },
          {
            id: "custom.snapshot-error",
            label: "snapshot error",
            mutates: false,
            output: "snapshot",
            run: async ({ machine }) => ({
              kind: "snapshot",
              snapshot: machine.getSnapshot(),
              transitioned: false,
              error: "snapshot warning"
            })
          },
          {
            id: "custom.throw-object",
            label: "throw object",
            mutates: false,
            output: "void",
            run: async () => {
              throw { reason: "object failure" };
            }
          },
          {
            id: "custom.throw-cause",
            label: "throw cause",
            mutates: false,
            output: "void",
            run: async () => {
              const error = new Error("caused failure", { cause: circular });
              error.stack = undefined;
              throw error;
            }
          }
        ]
      }
    ];

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-custom",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-custom"
      )
    );

    window.dispatchEvent(
      buildInvokeEnvelope("m-custom", "req-text", {
        operationId: "custom.describe"
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-custom", "req-data", {
        operationId: "custom.inspect"
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-custom", "req-circular", {
        operationId: "custom.circular"
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-custom", "req-function", {
        operationId: "custom.function"
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-custom", "req-throwing-json", {
        operationId: "custom.throwing-json"
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-custom", "req-void", {
        operationId: "custom.flush"
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-custom", "req-snapshot-error", {
        operationId: "custom.snapshot-error"
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-custom", "req-throw-object", {
        operationId: "custom.throw-object"
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-custom", "req-throw-cause", {
        operationId: "custom.throw-cause"
      })
    );

    await waitForCollector(
      () =>
        [
          "req-text",
          "req-data",
          "req-circular",
          "req-function",
          "req-throwing-json",
          "req-snapshot-error",
          "req-void"
        ].every((requestId) =>
          collector.messages.some((message) => message.requestId === requestId)
        ) &&
        collector.messages.some(
          (message) => message.kind === "operationError" && message.requestId === "req-throw-object"
        ) &&
        collector.messages.some(
          (message) => message.kind === "operationError" && message.requestId === "req-throw-cause"
        )
    );

    expect(
      collector.messages.find(
        (message) => message.kind === "operationResult" && message.requestId === "req-text"
      )
    ).toMatchObject({
      kind: "operationResult",
      result: { kind: "text", text: "described" }
    });
    expect(
      collector.messages.find(
        (message) => message.kind === "operationResult" && message.requestId === "req-data"
      )
    ).toMatchObject({
      kind: "operationResult",
      result: { kind: "data", data: { branch: "covered" } }
    });
    expect(
      collector.messages.find(
        (message) => message.kind === "operationResult" && message.requestId === "req-circular"
      )
    ).toMatchObject({
      kind: "operationResult",
      result: { kind: "data", data: { name: "loop", self: "[Circular]" } }
    });
    expect(
      collector.messages.find(
        (message) => message.kind === "operationResult" && message.requestId === "req-function"
      )
    ).toMatchObject({
      kind: "operationResult",
      result: { kind: "data", data: undefined }
    });
    expect(
      collector.messages.find(
        (message) => message.kind === "operationResult" && message.requestId === "req-throwing-json"
      )
    ).toMatchObject({
      kind: "operationResult",
      result: { kind: "data", data: "[object Object]" }
    });
    expect(
      collector.messages.find(
        (message) => message.kind === "operationResult" && message.requestId === "req-void"
      )
    ).toMatchObject({
      kind: "operationResult",
      result: { kind: "void" }
    });
    expect(
      collector.messages.find(
        (message) =>
          message.kind === "operationResult" && message.requestId === "req-snapshot-error"
      )
    ).toMatchObject({
      kind: "operationResult",
      result: {
        kind: "snapshot",
        transitioned: false,
        error: { message: "snapshot warning" }
      }
    });
    expect(
      collector.messages.find(
        (message) => message.kind === "operationError" && message.requestId === "req-throw-object"
      )
    ).toMatchObject({
      kind: "operationError",
      error: { message: "Unknown error", cause: { reason: "object failure" } }
    });
    expect(
      collector.messages.find(
        (message) => message.kind === "operationError" && message.requestId === "req-throw-cause"
      )
    ).toMatchObject({
      kind: "operationError",
      error: {
        message: "caused failure",
        stack: null,
        cause: { name: "loop", self: "[Circular]" }
      }
    });

    detach();
    collector.stop();
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      value: originalStructuredClone
    });
  });
});

describe("attachJourneyDevtools v6", () => {
  type AsyncStepId = "loading" | "ready" | "timeout";
  type AsyncMeta = { label: string };

  const createEffectJourney = (): JourneyDefinition<
    { value: string | null },
    AsyncStepId,
    Record<never, never>,
    AsyncMeta
  > => ({
    initial: "loading",
    context: { value: null },
    steps: {
      loading: {
        meta: { label: "Loading" },
        onEnter: () => {},
        effect: {
          // Never settles, so the step stays in the `invoking` phase.
          run: () => new Promise<string>(() => {}),
          onResolved: { to: "ready" }
        }
      },
      ready: {
        onLeave: () => {}
      },
      timeout: {
        after: {
          5000: { to: "loading" },
          1000: { to: "ready" }
        }
      }
    },
    transitions: {}
  });

  it("surfaces per-step feature descriptors in the register envelope", async () => {
    const collector = collectBridgeMessages();
    const machine = createJourneyMachine(createEffectJourney(), { plugins: [] as const });
    await machine.startJourney();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-v6-steps",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-v6-steps"
      )
    );

    const register = collector.messages.find(
      (message) => message.kind === "register" && message.machineId === "m-v6-steps"
    );

    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.version).toBe(JOURNEY_DEVTOOLS_PROTOCOL_VERSION);
      expect(register.meta.steps).toEqual({
        loading: {
          hasEffect: true,
          afterDelays: [],
          hasOnEnter: true,
          hasOnLeave: false,
          hasMeta: true
        },
        ready: {
          hasEffect: false,
          afterDelays: [],
          hasOnEnter: false,
          hasOnLeave: true,
          hasMeta: false
        },
        timeout: {
          hasEffect: false,
          afterDelays: [1000, 5000],
          hasOnEnter: false,
          hasOnLeave: false,
          hasMeta: false
        }
      });
    }

    detach();
    collector.stop();
  });

  it("serializes the `invoking` async phase for a step running an effect", async () => {
    const collector = collectBridgeMessages();
    const machine = createJourneyMachine(createEffectJourney(), { plugins: [] as const });
    await machine.startJourney();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-v6-invoking",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-v6-invoking"
      )
    );

    const register = collector.messages.find(
      (message) => message.kind === "register" && message.machineId === "m-v6-invoking"
    );

    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.snapshot.async.byStep.loading?.phase).toBe("invoking");
    }

    detach();
    collector.stop();
  });

  it("excludes internal effect/after events from the invokable event metadata", async () => {
    const collector = collectBridgeMessages();
    const machine = createJourneyMachine(createEffectJourney(), { plugins: [] as const });
    await machine.startJourney();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-v6-events",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-v6-events"
      )
    );

    const register = collector.messages.find(
      (message) => message.kind === "register" && message.machineId === "m-v6-events"
    );

    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      const advertised = [
        ...(register.meta.eventTypes ?? []),
        ...Object.values(register.meta.eventTypesBySource ?? {}).flat()
      ];
      expect(advertised.some((eventType) => eventType.startsWith("@@journey."))).toBe(false);
    }

    detach();
    collector.stop();
  });

  it("accepts invoke envelopes from the prior protocol version (v5 back-compat)", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-v5-compat",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-v5-compat"
      )
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION,
          source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
          kind: "invoke",
          machineId: "m-v5-compat",
          requestId: "req-v5",
          invocation: { operationId: "core.goToNextStep" },
          timestamp: Date.now()
        }
      })
    );

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "operationResult" && message.requestId === "req-v5"
      )
    );

    const result = collector.messages.find(
      (message) => message.kind === "operationResult" && message.requestId === "req-v5"
    );
    expect(result?.kind).toBe("operationResult");
    if (result?.kind === "operationResult" && result.result.kind === "snapshot") {
      expect(result.result.snapshot.currentStepId).toBe("review");
    }

    detach();
    collector.stop();
  });
});
