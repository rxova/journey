import { afterEach, describe, expect, it, vi } from "vitest";

import type { JourneyMachine, JourneySendResult, JourneySnapshot } from "@rxova/journey-core";
import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  attachJourneyDevtools,
  isJourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsExtensionEnvelope
} from "@rxova/journey-devtools-bridge";
import { resolveNonProductionEnvironment } from "../src/bridge";

type StepId = "start" | "review" | "guard" | "effect";
type Event = "goToNextStep" | "custom" | "send" | "resolve" | "reject" | "cause" | "bad-stack";
type Context = Record<string, unknown>;

type Snapshot = JourneySnapshot<Context, StepId>;

const createSnapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({
  currentStepId: "start",
  history: {
    timeline: ["start"],
    index: 0
  },
  context: { count: 0 },
  visited: { start: true, review: false, guard: false, effect: false },
  stepMeta: {
    start: undefined,
    review: undefined,
    guard: undefined,
    effect: undefined
  },
  status: "running",
  async: {
    isLoading: true,
    byStep: {
      start: { phase: "idle", eventType: null, transitionId: null, error: null },
      review: {
        phase: "evaluating-when",
        eventType: "goToNextStep",
        transitionId: "t-1",
        error: null
      },
      guard: {
        phase: "running-effect",
        eventType: "goToNextStep",
        transitionId: "t-2",
        error: null
      },
      effect: { phase: "error", eventType: "goToNextStep", transitionId: "t-3", error: "boom" }
    }
  },
  ...overrides
});

const waitForMessages = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

const waitForCollector = async (predicate: () => boolean, timeoutMs = 300): Promise<void> => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for bridge message.");
    }
    await waitForMessages();
  }
};

const collectBridgeMessages = () => {
  const messages: JourneyDevtoolsBridgeEnvelope[] = [];
  const listener = (event: MessageEvent<unknown>) => {
    if (isJourneyDevtoolsBridgeEnvelope(event.data)) {
      messages.push(event.data);
    }
  };

  window.addEventListener("message", listener);
  return {
    messages,
    stop: () => window.removeEventListener("message", listener)
  };
};

const buildCommandEnvelope = (
  machineId: string,
  requestId: string,
  command: JourneyDevtoolsExtensionEnvelope["command"],
  origin = window.location.origin
) =>
  new MessageEvent("message", {
    source: window,
    origin,
    data: {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "command",
      machineId,
      requestId,
      command,
      timestamp: Date.now()
    } satisfies JourneyDevtoolsExtensionEnvelope
  });

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const createMachine = (sendImpl?: JourneyMachine<Context, StepId, Event>["send"]) => {
  let snapshot = createSnapshot();
  const listeners = new Set<() => void>();
  const machine: JourneyMachine<Context, StepId, Event> = {
    getSnapshot: () => snapshot,
    send:
      sendImpl ??
      (async (event) => {
        if (event.type === "goToNextStep") {
          snapshot = createSnapshot({
            currentStepId: "review",
            history: {
              timeline: ["start", "review"],
              index: 1
            }
          });
          listeners.forEach((listener) => listener());
        }
        return { transitioned: true, snapshot, transitionId: event.type };
      }),
    goToNextStep: async () => ({
      transitioned: true,
      snapshot,
      transitionId: "goToNextStep"
    }),
    terminateJourney: async () => ({
      transitioned: true,
      snapshot,
      transitionId: "terminateJourney"
    }),
    completeJourney: async () => ({
      transitioned: true,
      snapshot,
      transitionId: "completeJourney"
    }),
    goToPreviousStep: async () => ({ transitioned: false, snapshot }),
    goToLastVisitedStep: async () => ({ transitioned: false, snapshot }),
    updateContext: () => snapshot,
    updateStepMetadata: () => snapshot,
    clearStepError: () => snapshot,
    resetMachine: () => snapshot,
    dispose: () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => undefined;
    },
    subscribeSelector: () => () => undefined,
    subscribeEvent: () => () => undefined
  };

  return {
    machine,
    pushSnapshot: () => {
      listeners.forEach((listener) => listener());
    },
    setSnapshot: (next: Snapshot) => {
      snapshot = next;
    }
  };
};

describe("bridge edge coverage", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalStructuredClone = globalThis.structuredClone;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      writable: true,
      value: originalStructuredClone
    });
    vi.unstubAllGlobals();
  });

  it("uses process env fallback when bundler env is unavailable", () => {
    expect(resolveNonProductionEnvironment({ bundlerEnv: null, nodeEnv: "development" })).toBe(
      true
    );
    expect(resolveNonProductionEnvironment({ bundlerEnv: null, nodeEnv: "production" })).toBe(
      false
    );
  });

  it("returns disabled when neither bundler env nor process env is available", () => {
    expect(resolveNonProductionEnvironment({ bundlerEnv: null, nodeEnv: undefined })).toBe(false);
  });

  it("sanitizes structured-cloneable snapshot values to protocol-safe payloads", async () => {
    const collector = collectBridgeMessages();
    const createdAt = new Date("2026-03-07T08:00:00.000Z");
    const reviewedAt = new Date("2026-03-07T08:05:00.000Z");

    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      writable: true,
      value:
        originalStructuredClone ??
        ((value: unknown) =>
          JSON.parse(
            JSON.stringify(value, (_key, currentValue) =>
              typeof currentValue === "bigint" ? currentValue.toString() : currentValue
            )
          ))
    });

    const { machine, pushSnapshot, setSnapshot } = createMachine();
    setSnapshot(
      createSnapshot({
        context: {
          count: 1n,
          createdAt
        }
      })
    );

    const detach = attachJourneyDevtools(machine, {
      machineId: "json-safe-transport",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "json-safe-transport"
      )
    );

    const register = collector.messages.find(
      (message) => message.kind === "register" && message.machineId === "json-safe-transport"
    );
    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.snapshot.context).toEqual({
        count: "1",
        createdAt: createdAt.toISOString()
      });
    }

    setSnapshot(
      createSnapshot({
        currentStepId: "review",
        history: {
          timeline: ["start", "review"],
          index: 1
        },
        context: {
          count: 2n,
          reviewedAt
        }
      })
    );
    pushSnapshot();

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "snapshot" && message.machineId === "json-safe-transport"
      )
    );

    const snapshot = collector.messages.find(
      (message) => message.kind === "snapshot" && message.machineId === "json-safe-transport"
    );
    expect(snapshot?.kind).toBe("snapshot");
    if (snapshot?.kind === "snapshot") {
      expect(snapshot.snapshot.context).toEqual({
        count: "2",
        reviewedAt: reviewedAt.toISOString()
      });
    }

    detach();
    collector.stop();
  });

  it("prefers import.meta env defaults over NODE_ENV", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    process.env.NODE_ENV = "production";
    const enabledDetach = attachJourneyDevtools(machine, {
      machineId: "import-meta-precedence"
    });
    await waitForMessages();

    const register = collector.messages.find(
      (message) => message.kind === "register" && message.machineId === "import-meta-precedence"
    );
    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.meta.commandsEnabled).toBe(true);
    }

    enabledDetach();
    collector.stop();
  });

  it("uses bundler env defaults when process is unavailable", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();
    const originalProcessDescriptor = Object.getOwnPropertyDescriptor(globalThis, "process");

    try {
      Object.defineProperty(globalThis, "process", {
        configurable: true,
        value: undefined
      });
      const enabledDetach = attachJourneyDevtools(machine, {
        machineId: "bundler-env-default"
      });
      await waitForMessages();

      const register = collector.messages.find(
        (message) => message.kind === "register" && message.machineId === "bundler-env-default"
      );
      expect(register?.kind).toBe("register");
      if (register?.kind === "register") {
        expect(register.meta.commandsEnabled).toBe(true);
      }

      enabledDetach();
    } finally {
      if (originalProcessDescriptor) {
        Object.defineProperty(globalThis, "process", originalProcessDescriptor);
      }
      collector.stop();
    }
  });

  it("serializes complex values and handles unsupported throwables", async () => {
    const collector = collectBridgeMessages();
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      writable: true,
      value: undefined
    });

    const anonymousFn = function () {
      return "anonymous";
    };
    Object.defineProperty(anonymousFn, "name", {
      configurable: true,
      value: ""
    });

    const circularContext: Record<string, unknown> = {
      bigint: 123n,
      fn: () => "fn",
      unnamedFn: anonymousFn
    };
    circularContext.symbol = Symbol("s");
    circularContext.self = circularContext;
    const badThrowable = {
      toJSON() {
        throw new Error("cannot serialize");
      },
      toString() {
        return "[non-serializable]";
      }
    };

    const { machine } = createMachine(async (event) => {
      if (event.type === "send" && event.payload === undefined) {
        throw undefined;
      }
      if (event.type === "cause") {
        const errorWithCause = new Error("has cause");
        (errorWithCause as { cause?: unknown }).cause = { why: "details" };
        throw errorWithCause;
      }
      if (event.type === "bad-stack") {
        const nonStringStack = new Error("bad stack");
        (nonStringStack as { stack?: unknown }).stack = 123;
        throw nonStringStack;
      }
      if (event.type === "custom") {
        throw badThrowable;
      }
      const snapshot = createSnapshot({ context: circularContext });
      snapshot.async.byStep.start = {
        phase: "not-a-real-phase" as Snapshot["async"]["byStep"]["start"]["phase"],
        eventType: null,
        transitionId: null,
        error: null
      };
      return {
        transitioned: true,
        snapshot,
        transitionId: event.type
      } satisfies JourneySendResult<Context, StepId>;
    });
    const detach = attachJourneyDevtools(machine, {
      machineId: "serialize-edge",
      enabled: true,
      commandsEnabled: true
    });

    await waitForMessages();

    const register = collector.messages.find((message) => message.kind === "register");
    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.snapshot.async.byStep.review?.phase).toBe("evaluating-when");
      expect(register.snapshot.async.byStep.guard?.phase).toBe("running-effect");
      expect(register.snapshot.async.byStep.effect?.phase).toBe("error");
      expect(register.snapshot.async.byStep.start?.phase).toBe("idle");
    }

    window.dispatchEvent(
      buildCommandEnvelope("serialize-edge", "req-send-no-payload", {
        type: "send",
        event: { type: "send" }
      })
    );
    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "commandError" && message.requestId === "req-send-no-payload"
      )
    );

    window.dispatchEvent(
      buildCommandEnvelope("serialize-edge", "req-custom-throwable", {
        type: "send",
        event: { type: "custom" }
      })
    );
    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "commandError" && message.requestId === "req-custom-throwable"
      )
    );

    const throwableError = collector.messages.find(
      (message) => message.kind === "commandError" && message.requestId === "req-custom-throwable"
    );
    expect(throwableError?.kind).toBe("commandError");
    if (throwableError?.kind === "commandError") {
      expect(throwableError.error.cause).toBe("[non-serializable]");
    }

    window.dispatchEvent(
      buildCommandEnvelope("serialize-edge", "req-error-cause", {
        type: "send",
        event: { type: "cause" }
      })
    );
    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "commandError" && message.requestId === "req-error-cause"
      )
    );
    const causeError = collector.messages.find(
      (message) => message.kind === "commandError" && message.requestId === "req-error-cause"
    );
    expect(causeError?.kind).toBe("commandError");
    if (causeError?.kind === "commandError") {
      expect(causeError.error.cause).toEqual({ why: "details" });
    }

    window.dispatchEvent(
      buildCommandEnvelope("serialize-edge", "req-bad-stack", {
        type: "send",
        event: { type: "bad-stack" }
      })
    );
    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "commandError" && message.requestId === "req-bad-stack"
      )
    );
    const badStackError = collector.messages.find(
      (message) => message.kind === "commandError" && message.requestId === "req-bad-stack"
    );
    expect(badStackError?.kind).toBe("commandError");
    if (badStackError?.kind === "commandError") {
      expect(badStackError.error.stack).toBeNull();
    }

    window.dispatchEvent(
      buildCommandEnvelope("serialize-edge", "req-success", {
        type: "send",
        event: { type: "goToNextStep" }
      })
    );
    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "commandResult" && message.requestId === "req-success"
      )
    );
    const success = collector.messages.find(
      (message) => message.kind === "commandResult" && message.requestId === "req-success"
    );
    expect(success?.kind).toBe("commandResult");
    if (success?.kind === "commandResult") {
      const context = success.snapshot.context as Record<string, unknown>;
      expect(context.bigint).toBe("123");
      expect(context.fn).toContain("[Function");
      expect(context.unnamedFn).toBe("[Function anonymous]");
      expect(context.symbol).toContain("Symbol(");
      expect(context.self).toBe("[Circular]");
      expect(success.snapshot.async.byStep.start?.phase).toBe("idle");
    }

    detach();
    collector.stop();
  });

  it("falls back safely when window is temporarily unavailable", async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const postMessage = vi.fn();
    const messageListeners = new Set<(event: MessageEvent<unknown>) => void>();
    const fakeWindow = {
      location: { origin: "https://example.test" },
      postMessage,
      addEventListener: vi.fn((type: string, listener: (event: MessageEvent<unknown>) => void) => {
        if (type === "message") {
          messageListeners.add(listener);
        }
      }),
      removeEventListener: vi.fn(
        (type: string, listener: (event: MessageEvent<unknown>) => void) => {
          if (type === "message") {
            messageListeners.delete(listener);
          }
        }
      )
    } as unknown as Window;

    let readCount = 0;
    let forceMissingWindow = false;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      get: () => {
        readCount += 1;
        if (forceMissingWindow || readCount === 2) {
          return undefined;
        }
        return fakeWindow;
      }
    });

    let detach: (() => void) | undefined;
    try {
      const { machine } = createMachine();
      detach = attachJourneyDevtools(machine, {
        machineId: "window-fallback",
        enabled: true,
        commandsEnabled: true
      });

      const register = postMessage.mock.calls.find(
        ([message]) =>
          typeof message === "object" &&
          message !== null &&
          (message as { kind?: string }).kind === "register"
      );
      expect(register).toBeDefined();
      expect(register?.[1]).toBe("*");

      const commandListener = Array.from(messageListeners)[0];
      if (!commandListener) {
        throw new Error("message listener not found");
      }

      forceMissingWindow = true;
      commandListener({
        source: undefined,
        origin: "https://example.test",
        data: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
          source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
          kind: "command",
          machineId: "window-fallback",
          requestId: "req-window-missing",
          command: { type: "goToNextStep" },
          timestamp: Date.now()
        } satisfies JourneyDevtoolsExtensionEnvelope
      } as unknown as MessageEvent<unknown>);
      await waitForMessages();
      expect(
        postMessage.mock.calls.some(
          ([message]) =>
            typeof message === "object" &&
            message !== null &&
            ((message as { kind?: string }).kind === "commandResult" ||
              (message as { kind?: string }).kind === "commandError")
        )
      ).toBe(false);

      forceMissingWindow = false;
      detach();
      detach = undefined;
    } finally {
      if (detach) {
        detach();
      }
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, "window", originalWindowDescriptor);
      }
    }
  });

  it("swallows postMessage failures across lifecycle and command posting", async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const messageListeners = new Set<(event: MessageEvent<unknown>) => void>();
    const postMessage = vi.fn(() => {
      throw new Error("post failed");
    });
    const fakeWindow = {
      location: { origin: "https://example.test" },
      postMessage,
      addEventListener: vi.fn((type: string, listener: (event: MessageEvent<unknown>) => void) => {
        if (type === "message") {
          messageListeners.add(listener);
        }
      }),
      removeEventListener: vi.fn(
        (type: string, listener: (event: MessageEvent<unknown>) => void) => {
          if (type === "message") {
            messageListeners.delete(listener);
          }
        }
      )
    } as unknown as Window;

    const snapshot = createSnapshot();
    const subscribers = new Set<() => void>();
    const send = vi.fn(async () => ({
      transitioned: true,
      snapshot,
      transitionId: "goToNextStep"
    }));
    const machine: JourneyMachine<Context, StepId, Event> = {
      getSnapshot: () => snapshot,
      send,
      goToNextStep: async () => ({ transitioned: true, snapshot, transitionId: "goToNextStep" }),
      terminateJourney: async () => ({
        transitioned: true,
        snapshot,
        transitionId: "terminateJourney"
      }),
      completeJourney: async () => ({
        transitioned: true,
        snapshot,
        transitionId: "completeJourney"
      }),
      goToPreviousStep: async () => ({ transitioned: false, snapshot }),
      goToLastVisitedStep: async () => ({ transitioned: false, snapshot }),
      updateContext: () => snapshot,
      updateStepMetadata: () => snapshot,
      clearStepError: () => snapshot,
      resetMachine: () => snapshot,
      dispose: () => undefined,
      subscribe: (listener) => {
        subscribers.add(listener);
        return () => {
          subscribers.delete(listener);
        };
      },
      subscribeSelector: () => () => undefined,
      subscribeEvent: () => () => undefined
    };

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: fakeWindow
    });

    let detach: (() => void) | undefined;
    try {
      expect(() => {
        detach = attachJourneyDevtools(machine, {
          machineId: "post-failure",
          enabled: true,
          commandsEnabled: true
        });
      }).not.toThrow();

      subscribers.forEach((listener) => listener());

      const commandListener = Array.from(messageListeners)[0];
      if (!commandListener) {
        throw new Error("message listener not registered");
      }

      commandListener({
        source: fakeWindow,
        origin: "https://example.test",
        data: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
          source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
          kind: "command",
          machineId: "post-failure",
          requestId: "req-post-failure",
          command: { type: "goToNextStep" },
          timestamp: Date.now()
        } satisfies JourneyDevtoolsExtensionEnvelope
      } as MessageEvent<unknown>);
      await waitForMessages();

      expect(send).toHaveBeenCalledWith({ type: "goToNextStep" });
      expect(postMessage).toHaveBeenCalled();
      expect(() => detach?.()).not.toThrow();
    } finally {
      if (detach) {
        detach();
      }
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, "window", originalWindowDescriptor);
      }
    }
  });

  it("supports null-origin windows and generated machine ids", async () => {
    process.env.NODE_ENV = "development";
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      writable: true,
      value: () => {
        throw new Error("force fallback");
      }
    });

    const postMessage = vi.fn();
    const messageListeners = new Set<(event: MessageEvent<unknown>) => void>();
    const fakeWindow = {
      location: { origin: "null" },
      postMessage,
      addEventListener: vi.fn((type: string, listener: (event: MessageEvent<unknown>) => void) => {
        if (type === "message") {
          messageListeners.add(listener);
        }
      }),
      removeEventListener: vi.fn(
        (type: string, listener: (event: MessageEvent<unknown>) => void) => {
          if (type === "message") {
            messageListeners.delete(listener);
          }
        }
      )
    } as unknown as Window;
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("document", undefined);

    const snapshot = createSnapshot({
      context: {
        bigint: 3n,
        fn: () => "x",
        sym: Symbol("n")
      },
      async: {
        isLoading: true,
        byStep: {
          start: { phase: "idle", eventType: null, transitionId: null, error: null },
          weird: 123 as unknown as Snapshot["async"]["byStep"][StepId]
        } as unknown as Snapshot["async"]["byStep"]
      }
    });
    const machine: JourneyMachine<Context, StepId, Event> = {
      getSnapshot: () => snapshot,
      send: async () => ({ transitioned: true, snapshot, transitionId: "goToNextStep" }),
      goToNextStep: async () => ({ transitioned: true, snapshot, transitionId: "goToNextStep" }),
      terminateJourney: async () => ({
        transitioned: true,
        snapshot,
        transitionId: "terminateJourney"
      }),
      completeJourney: async () => ({
        transitioned: true,
        snapshot,
        transitionId: "completeJourney"
      }),
      goToPreviousStep: async () => ({ transitioned: false, snapshot }),
      goToLastVisitedStep: async () => ({ transitioned: false, snapshot }),
      updateContext: () => snapshot,
      updateStepMetadata: () => snapshot,
      clearStepError: () => snapshot,
      resetMachine: () => snapshot,
      dispose: () => undefined,
      subscribe: () => () => undefined,
      subscribeSelector: () => () => undefined,
      subscribeEvent: () => () => undefined
    };
    const detach = attachJourneyDevtools(machine, {
      machineId: "   ",
      label: "  "
    });

    const registerCall = postMessage.mock.calls.find(
      ([message]) =>
        typeof message === "object" &&
        message !== null &&
        (message as { kind?: string }).kind === "register"
    );
    expect(registerCall).toBeDefined();
    expect(registerCall?.[1]).toBe("*");
    const registerEnvelope = registerCall?.[0] as {
      meta: { machineId: string; label: string; appName: string | null };
      machineId: string;
    };
    expect(registerEnvelope.machineId).toContain("journey-");
    expect(registerEnvelope.meta.label).toBe("Journey Machine");
    expect(registerEnvelope.meta.appName).toBeNull();

    const commandEnvelope: JourneyDevtoolsExtensionEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "command",
      machineId: registerEnvelope.machineId,
      requestId: "req-null-origin",
      command: { type: "goToNextStep" },
      timestamp: Date.now()
    };
    for (const listener of messageListeners) {
      listener({
        source: fakeWindow,
        origin: "null",
        data: commandEnvelope
      } as MessageEvent<unknown>);
    }
    await waitForMessages();

    expect(
      postMessage.mock.calls.some(
        ([message]) =>
          typeof message === "object" &&
          message !== null &&
          (message as { kind?: string; requestId?: string }).kind === "commandResult" &&
          (message as { requestId?: string }).requestId === "req-null-origin"
      )
    ).toBe(true);

    detach();
  });

  it("returns noop detach when bridge is disabled", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    const detach = attachJourneyDevtools(machine, { enabled: false });
    await waitForMessages();
    expect(collector.messages).toHaveLength(0);
    expect(() => detach()).not.toThrow();
    collector.stop();
  });

  it("omits transitionId in command results when machine does not provide one", async () => {
    const collector = collectBridgeMessages();
    const snapshot = createSnapshot({
      async: {
        isLoading: true,
        byStep: {
          start: {
            phase: "idle",
            eventType: 123 as unknown as string,
            transitionId: 7 as unknown as string,
            error: null
          },
          review: {
            phase: "evaluating-when",
            eventType: "goToNextStep",
            transitionId: "t-1",
            error: null
          },
          guard: {
            phase: "running-effect",
            eventType: "goToNextStep",
            transitionId: "t-2",
            error: null
          },
          effect: { phase: "error", eventType: "goToNextStep", transitionId: "t-3", error: "boom" }
        }
      }
    });

    const machine: JourneyMachine<Context, StepId, Event> = {
      getSnapshot: () => snapshot,
      send: async () => ({ transitioned: true, snapshot }),
      goToNextStep: async () => ({ transitioned: true, snapshot }),
      terminateJourney: async () => ({ transitioned: true, snapshot }),
      completeJourney: async () => ({ transitioned: true, snapshot }),
      goToPreviousStep: async () => ({ transitioned: true, snapshot }),
      goToLastVisitedStep: async () => ({ transitioned: true, snapshot }),
      updateContext: () => snapshot,
      updateStepMetadata: () => snapshot,
      clearStepError: () => snapshot,
      resetMachine: () => snapshot,
      dispose: () => undefined,
      subscribe: () => () => undefined,
      subscribeSelector: () => () => undefined,
      subscribeEvent: () => () => undefined
    };

    const detach = attachJourneyDevtools(machine, {
      machineId: "no-transition-id",
      enabled: true,
      commandsEnabled: true,
      appName: "  "
    });
    await waitForMessages();

    const register = collector.messages.find((message) => message.kind === "register");
    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.snapshot.async.byStep.start?.eventType).toBeNull();
      expect(register.snapshot.async.byStep.start?.transitionId).toBeNull();
      expect(register.meta.appName).toBeNull();
    }

    const commands: JourneyDevtoolsExtensionEnvelope["command"][] = [
      { type: "goToNextStep" },
      { type: "goToStepById", stepId: "review" },
      { type: "goToPreviousStep", steps: 2 },
      { type: "goToLastVisitedStep" },
      { type: "send", event: { type: "custom" } }
    ];

    for (const [index, command] of commands.entries()) {
      const requestId = `req-no-id-${index}`;
      window.dispatchEvent(buildCommandEnvelope("no-transition-id", requestId, command));
      await waitForCollector(() =>
        collector.messages.some(
          (message) => message.kind === "commandResult" && message.requestId === requestId
        )
      );
    }

    const results = collector.messages.filter((message) => message.kind === "commandResult");
    for (const result of results) {
      expect("transitionId" in result).toBe(false);
    }

    detach();
    collector.stop();
  });

  it("ignores empty-origin and non-command envelopes", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();
    const detach = attachJourneyDevtools(machine, {
      machineId: "ignore-shapes",
      enabled: true,
      commandsEnabled: true
    });

    await waitForMessages();

    window.dispatchEvent(
      buildCommandEnvelope("ignore-shapes", "req-empty-origin", { type: "goToNextStep" }, "")
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
          source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
          kind: "snapshot",
          machineId: "ignore-shapes",
          timestamp: Date.now(),
          snapshot: {}
        }
      })
    );

    await waitForMessages();

    const outcomes = collector.messages.filter(
      (message) => message.kind === "commandResult" || message.kind === "commandError"
    );
    expect(outcomes).toHaveLength(0);

    detach();
    collector.stop();
  });

  it("rate-limits command execution bursts", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();
    const detach = attachJourneyDevtools(machine, {
      machineId: "rate-limit",
      enabled: true,
      commandsEnabled: true
    });

    await waitForMessages();

    for (let index = 0; index < 101; index += 1) {
      window.dispatchEvent(
        buildCommandEnvelope("rate-limit", `req-rate-${index}`, {
          type: "send",
          event: { type: "goToNextStep" }
        })
      );
    }

    await waitForCollector(
      () =>
        collector.messages.some(
          (message) =>
            message.kind === "commandError" &&
            typeof message.error.message === "string" &&
            message.error.message.includes("rate limit")
        ),
      1000
    );

    expect(
      collector.messages.some(
        (message) =>
          message.kind === "commandError" &&
          typeof message.error.message === "string" &&
          message.error.message.includes("rate limit")
      )
    ).toBe(true);

    detach();
    collector.stop();
  });

  it("skips result and error posting after detach, and detach is idempotent", async () => {
    const collector = collectBridgeMessages();
    const resolveCommand = createDeferred<JourneySendResult<Context, StepId>>();
    const rejectCommand = createDeferred<JourneySendResult<Context, StepId>>();

    const { machine, pushSnapshot } = createMachine(async (event) => {
      if (event.type === "resolve") {
        return resolveCommand.promise;
      }
      if (event.type === "reject") {
        return rejectCommand.promise;
      }
      return { transitioned: false, snapshot: createSnapshot() };
    });

    const detach = attachJourneyDevtools(machine, {
      machineId: "detach-edge",
      enabled: true,
      commandsEnabled: true
    });
    await waitForMessages();

    window.dispatchEvent(
      buildCommandEnvelope("detach-edge", "req-resolve", {
        type: "send",
        event: { type: "resolve" }
      })
    );
    window.dispatchEvent(
      buildCommandEnvelope("detach-edge", "req-reject", {
        type: "send",
        event: { type: "reject" }
      })
    );

    detach();
    detach();

    resolveCommand.resolve({
      transitioned: true,
      snapshot: createSnapshot({
        currentStepId: "review",
        history: { timeline: ["start", "review"], index: 1 }
      }),
      transitionId: "resolve"
    });
    rejectCommand.reject(new Error("late failure"));
    pushSnapshot();
    await waitForMessages();

    expect(
      collector.messages.some(
        (message) => message.kind === "commandResult" && message.requestId === "req-resolve"
      )
    ).toBe(false);
    expect(
      collector.messages.some(
        (message) => message.kind === "commandError" && message.requestId === "req-reject"
      )
    ).toBe(false);

    collector.stop();
  });
});
