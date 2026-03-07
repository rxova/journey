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

describe("content script bridge", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (window as Window & { [CONTENT_BRIDGE_FLAG]?: boolean })[CONTENT_BRIDGE_FLAG];
  });

  it("forwards bridge envelopes to background and forwards extension envelopes to window", async () => {
    const runtimeRef: { current?: RuntimeMessageListener } = {};
    const windowRef: { current?: WindowMessageListener } = {};

    const sendMessage = vi.fn();
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => {});
    const addEventListener = vi
      .spyOn(window, "addEventListener")
      .mockImplementation((type, listener) => {
        if (type === "message") {
          windowRef.current = listener as WindowMessageListener;
        }
      });

    const chromeMock = {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: RuntimeMessageListener) => {
            runtimeRef.current = listener;
          })
        }
      }
    } as unknown as typeof chrome;

    vi.stubGlobal("chrome", chromeMock);
    await import("../src/content");

    expect(addEventListener).toHaveBeenCalledWith("message", expect.any(Function));
    expect(runtimeRef.current).toBeTypeOf("function");
    expect(windowRef.current).toBeTypeOf("function");
    const runtime = runtimeRef.current;
    const windowListener = windowRef.current;
    if (!runtime || !windowListener) {
      throw new Error("listeners were not registered");
    }

    const registerEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "register",
      machineId: "machine-1",
      meta: {
        machineId: "machine-1",
        label: "Checkout",
        appName: "Storefront"
      },
      snapshot: { currentStepId: "start" },
      timestamp: Date.now()
    } as const;

    const bridgeEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "snapshot",
      machineId: "machine-1",
      snapshot: { currentStepId: "start" },
      timestamp: Date.now()
    } as const;

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
        data: bridgeEnvelope
      })
    );

    expect(sendMessage).toHaveBeenCalledWith({
      type: "bridge-envelope",
      envelope: registerEnvelope
    });
    expect(sendMessage).toHaveBeenCalledWith({ type: "bridge-envelope", envelope: bridgeEnvelope });
    sendMessage.mockClear();

    const extensionEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "command",
      machineId: "machine-1",
      requestId: "req-1",
      command: { type: "goToNextStep" },
      timestamp: Date.now()
    } as const;

    runtime({ type: "extension-envelope", envelope: extensionEnvelope });
    runtime({ type: "bridge-replay-request" });

    expect(postMessage).toHaveBeenCalledWith(extensionEnvelope, window.location.origin);
    expect(sendMessage).toHaveBeenCalledWith({
      type: "bridge-envelope",
      envelope: registerEnvelope
    });
    expect(sendMessage).toHaveBeenCalledWith({ type: "bridge-envelope", envelope: bridgeEnvelope });
  });

  it("ignores malformed and foreign-source messages", async () => {
    const runtimeRef: { current?: RuntimeMessageListener } = {};
    const windowRef: { current?: WindowMessageListener } = {};

    const sendMessage = vi.fn();
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => {});

    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (type === "message") {
        windowRef.current = listener as WindowMessageListener;
      }
    });

    const chromeMock = {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: RuntimeMessageListener) => {
            runtimeRef.current = listener;
          })
        }
      }
    } as unknown as typeof chrome;

    vi.stubGlobal("chrome", chromeMock);
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
        data: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
          source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
          kind: "snapshot",
          machineId: "machine-empty-origin",
          snapshot: { currentStepId: "start" },
          timestamp: Date.now()
        }
      })
    );
    windowListener(
      new MessageEvent("message", {
        source: window,
        origin: "https://evil.example",
        data: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
          source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
          kind: "snapshot",
          machineId: "machine-1",
          snapshot: { currentStepId: "start" },
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
          source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
          kind: "command",
          machineId: "machine-1",
          requestId: "req-1",
          command: { type: "goToNextStep" },
          timestamp: Date.now()
        }
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();

    runtime({ type: "bad-message" });
    runtime({
      type: "extension-envelope",
      envelope: {
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "snapshot",
        machineId: "machine-1",
        snapshot: { currentStepId: "start" },
        timestamp: Date.now()
      }
    });

    expect(postMessage).not.toHaveBeenCalled();
  });

  it("does not cache command outcomes and evicts cache on unregister", async () => {
    const runtimeRef: { current?: RuntimeMessageListener } = {};
    const windowRef: { current?: WindowMessageListener } = {};

    const sendMessage = vi.fn();

    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (type === "message") {
        windowRef.current = listener as WindowMessageListener;
      }
    });

    const chromeMock = {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: RuntimeMessageListener) => {
            runtimeRef.current = listener;
          })
        }
      }
    } as unknown as typeof chrome;

    vi.stubGlobal("chrome", chromeMock);
    await import("../src/content");
    const runtime = runtimeRef.current;
    const windowListener = windowRef.current;
    if (!runtime || !windowListener) {
      throw new Error("listeners were not registered");
    }

    const registerEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "register",
      machineId: "machine-evict",
      meta: { machineId: "machine-evict", label: "Flow", appName: "App" },
      snapshot: { currentStepId: "start" },
      timestamp: Date.now()
    } as const;

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
          kind: "commandResult",
          machineId: "machine-evict",
          requestId: "req-1",
          snapshot: { currentStepId: "review" },
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
          kind: "commandError",
          machineId: "machine-evict",
          requestId: "req-2",
          error: { name: "Error", message: "fail", stack: null, cause: null },
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
          machineId: "machine-evict",
          timestamp: Date.now()
        }
      })
    );

    sendMessage.mockClear();
    runtime({ type: "bridge-replay-request" });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("accepts null-origin pages and uses wildcard postMessage target", async () => {
    const runtimeRef: { current?: RuntimeMessageListener } = {};
    const windowRef: { current?: WindowMessageListener } = {};
    const sendMessage = vi.fn();

    const fakeWindow = {
      location: { origin: "null" },
      addEventListener: vi.fn((type: string, listener: WindowMessageListener) => {
        if (type === "message") {
          windowRef.current = listener;
        }
      }),
      postMessage: vi.fn()
    } as unknown as Window;
    vi.stubGlobal("window", fakeWindow);

    const chromeMock = {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: RuntimeMessageListener) => {
            runtimeRef.current = listener;
          })
        }
      }
    } as unknown as typeof chrome;

    vi.stubGlobal("chrome", chromeMock);
    await import("../src/content");

    const runtime = runtimeRef.current;
    const windowListener = windowRef.current;
    if (!runtime || !windowListener) {
      throw new Error("listeners were not registered");
    }

    const bridgeEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "snapshot",
      machineId: "machine-null",
      snapshot: { currentStepId: "start" },
      timestamp: Date.now()
    } as const;

    windowListener({
      source: fakeWindow,
      origin: "null",
      data: bridgeEnvelope
    } as MessageEvent<unknown>);

    expect(sendMessage).toHaveBeenCalledWith({
      type: "bridge-envelope",
      envelope: bridgeEnvelope
    });

    runtime({
      type: "extension-envelope",
      envelope: {
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "command",
        machineId: "machine-null",
        requestId: "req-null",
        command: { type: "goToNextStep" },
        timestamp: Date.now()
      }
    });

    expect(fakeWindow.postMessage).toHaveBeenCalledWith(expect.any(Object), "*");
  });

  it("replays snapshot-only cache entries and avoids duplicate listener installation", async () => {
    const runtimeListeners: RuntimeMessageListener[] = [];
    const windowListeners: WindowMessageListener[] = [];
    const sendMessage = vi.fn();

    const addEventListener = vi
      .spyOn(window, "addEventListener")
      .mockImplementation((type, listener) => {
        if (type === "message") {
          windowListeners.push(listener as WindowMessageListener);
        }
      });

    const chromeMock = {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: RuntimeMessageListener) => {
            runtimeListeners.push(listener);
          })
        }
      }
    } as unknown as typeof chrome;

    vi.stubGlobal("chrome", chromeMock);
    await import("../src/content");
    await import("../src/content");

    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(runtimeListeners).toHaveLength(1);
    expect(windowListeners).toHaveLength(1);

    const runtime = runtimeListeners[0];
    const windowListener = windowListeners[0];
    if (!runtime || !windowListener) {
      throw new Error("listeners were not registered");
    }

    const snapshotEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "snapshot",
      machineId: "machine-snapshot-only",
      snapshot: { currentStepId: "review" },
      timestamp: Date.now()
    } as const;

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
  });

  it("skips listener installation when the bridge flag is already present", async () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const sendMessage = vi.fn();

    (window as Window & { [CONTENT_BRIDGE_FLAG]?: boolean })[CONTENT_BRIDGE_FLAG] = true;

    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn()
        }
      }
    } as unknown as typeof chrome);

    await import("../src/content");

    expect(addEventListener).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
