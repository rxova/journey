import { afterEach, describe, expect, it, vi } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION
} from "@rxova/journey-devtools-bridge";

type RuntimeMessageListener = (message: unknown) => void;
type WindowMessageListener = (event: MessageEvent<unknown>) => void;
const CONTENT_BRIDGE_FLAG = "__RXOVA_JOURNEY_DEVTOOLS_CONTENT_BRIDGE_INSTALLED__";

const createRegisterEnvelope = () =>
  ({
    channel: JOURNEY_DEVTOOLS_CHANNEL,
    version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
    source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
    kind: "register",
    machineId: "machine-1",
    meta: {
      machineId: "machine-1",
      label: "Checkout",
      appName: "Storefront",
      mutationsEnabled: true,
      mode: "graph",
      features: [
        {
          id: "core",
          label: "Core",
          description: null,
          operations: [
            {
              id: "core.goToNextStep",
              label: "goToNextStep",
              description: null,
              mutates: true,
              output: "snapshot",
              fields: []
            }
          ]
        }
      ]
    },
    snapshot: {
      currentStepId: "start",
      history: { timeline: ["start"], index: 0 },
      context: { count: 0 },
      visited: { start: true },
      status: "running",
      async: { isLoading: false, byStep: {} }
    },
    timestamp: Date.now()
  }) as const;

const createSnapshotEnvelope = () =>
  ({
    channel: JOURNEY_DEVTOOLS_CHANNEL,
    version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
    source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
    kind: "snapshot",
    machineId: "machine-1",
    snapshot: {
      currentStepId: "review",
      history: { timeline: ["start", "review"], index: 1 },
      context: { count: 1 },
      visited: { start: true, review: true },
      status: "running",
      async: { isLoading: false, byStep: {} }
    },
    timestamp: Date.now()
  }) as const;

describe("content bridge", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (window as Window & { [CONTENT_BRIDGE_FLAG]?: boolean })[CONTENT_BRIDGE_FLAG];
  });

  it("forwards bridge envelopes to background and forwards invoke envelopes to window", async () => {
    const runtimeRef: { current?: RuntimeMessageListener } = {};
    const windowRef: { current?: WindowMessageListener } = {};

    const sendMessage = vi.fn();
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => {});
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (type === "message") {
        windowRef.current = listener as WindowMessageListener;
      }
    });

    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: RuntimeMessageListener) => {
            runtimeRef.current = listener;
          })
        }
      }
    } as unknown as typeof chrome);

    await import("../src/content");

    expect(postMessage).toHaveBeenCalledWith(
      { type: "__RXOVA_JOURNEY_DEVTOOLS_REPLAY_REQUEST__" },
      window.location.origin
    );

    const runtime = runtimeRef.current;
    const windowListener = windowRef.current;
    if (!runtime || !windowListener) {
      throw new Error("listeners were not registered");
    }

    const registerEnvelope = createRegisterEnvelope();
    const snapshotEnvelope = createSnapshotEnvelope();
    windowListener(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: registerEnvelope
      })
    );
    windowListener(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: snapshotEnvelope
      })
    );

    expect(sendMessage).toHaveBeenCalledWith({
      type: "bridge-envelope",
      envelope: registerEnvelope
    });
    expect(sendMessage).toHaveBeenCalledWith({
      type: "bridge-envelope",
      envelope: snapshotEnvelope
    });

    const invokeEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "invoke",
      machineId: "machine-1",
      requestId: "req-1",
      invocation: { operationId: "core.goToNextStep" },
      timestamp: Date.now()
    } as const;

    runtime({ type: "extension-envelope", envelope: invokeEnvelope });
    expect(postMessage).toHaveBeenCalledWith(invokeEnvelope, window.location.origin);

    sendMessage.mockClear();
    runtime({ type: "bridge-replay-request" });
    expect(postMessage).toHaveBeenCalledWith(
      { type: "__RXOVA_JOURNEY_DEVTOOLS_REPLAY_REQUEST__" },
      window.location.origin
    );
    expect(sendMessage).toHaveBeenCalledWith({
      type: "bridge-envelope",
      envelope: registerEnvelope
    });
    expect(sendMessage).toHaveBeenCalledWith({
      type: "bridge-envelope",
      envelope: snapshotEnvelope
    });
  });

  it("ignores malformed, foreign-origin, and foreign-source messages", async () => {
    const runtimeRef: { current?: RuntimeMessageListener } = {};
    const windowRef: { current?: WindowMessageListener } = {};

    const sendMessage = vi.fn();
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => {});

    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (type === "message") {
        windowRef.current = listener as WindowMessageListener;
      }
    });

    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: RuntimeMessageListener) => {
            runtimeRef.current = listener;
          })
        }
      }
    } as unknown as typeof chrome);

    await import("../src/content");

    const runtime = runtimeRef.current;
    const windowListener = windowRef.current;
    if (!runtime || !windowListener) {
      throw new Error("listeners were not registered");
    }

    windowListener(new MessageEvent("message", { source: window, data: { type: "invalid" } }));
    windowListener(
      new MessageEvent("message", {
        source: window,
        origin: "",
        data: createSnapshotEnvelope()
      })
    );
    windowListener(
      new MessageEvent("message", {
        source: window,
        origin: "https://evil.example",
        data: createSnapshotEnvelope()
      })
    );
    windowListener(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          ...createSnapshotEnvelope(),
          source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE
        }
      })
    );

    expect(sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "bridge-envelope"
      })
    );

    runtime({ type: "bad-message" });
    runtime({
      type: "extension-envelope",
      envelope: createSnapshotEnvelope()
    });
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("does not cache operation outcomes and evicts machines on unregister", async () => {
    const runtimeRef: { current?: RuntimeMessageListener } = {};
    const windowRef: { current?: WindowMessageListener } = {};
    const sendMessage = vi.fn();

    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (type === "message") {
        windowRef.current = listener as WindowMessageListener;
      }
    });

    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: RuntimeMessageListener) => {
            runtimeRef.current = listener;
          })
        }
      }
    } as unknown as typeof chrome);

    await import("../src/content");

    const runtime = runtimeRef.current;
    const windowListener = windowRef.current;
    if (!runtime || !windowListener) {
      throw new Error("listeners were not registered");
    }

    const registerEnvelope = createRegisterEnvelope();
    windowListener(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: registerEnvelope
      })
    );
    windowListener(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
          source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
          kind: "operationResult",
          machineId: "machine-1",
          requestId: "req-1",
          operationId: "core.goToNextStep",
          result: {
            kind: "snapshot",
            snapshot: registerEnvelope.snapshot,
            transitioned: true,
            transitionId: "goToNextStep"
          },
          timestamp: Date.now()
        }
      })
    );
    windowListener(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
          source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
          kind: "unregister",
          machineId: "machine-1",
          timestamp: Date.now()
        }
      })
    );

    sendMessage.mockClear();
    runtime({ type: "bridge-replay-request" });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("replays snapshot-only cache entries and skips duplicate installation", async () => {
    const runtimeRef: { current?: RuntimeMessageListener } = {};
    const windowRef: { current?: WindowMessageListener } = {};
    const sendMessage = vi.fn();
    const addEventListener = vi
      .spyOn(window, "addEventListener")
      .mockImplementation((type, listener) => {
        if (type === "message") {
          windowRef.current = listener as WindowMessageListener;
        }
      });

    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: RuntimeMessageListener) => {
            runtimeRef.current = listener;
          })
        }
      }
    } as unknown as typeof chrome);

    await import("../src/content");

    const runtime = runtimeRef.current;
    const windowListener = windowRef.current;
    if (!runtime || !windowListener) {
      throw new Error("listeners were not registered");
    }

    const snapshotEnvelope = createSnapshotEnvelope();
    windowListener(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: snapshotEnvelope
      })
    );

    sendMessage.mockClear();
    runtime({ type: "bridge-replay-request" });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      type: "bridge-envelope",
      envelope: snapshotEnvelope
    });

    vi.resetModules();
    await import("../src/content");
    expect(addEventListener).toHaveBeenCalledTimes(1);
  });
});
