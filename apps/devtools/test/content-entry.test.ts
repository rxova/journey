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

    const bridgeEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "snapshot",
      machineId: "machine-1",
      snapshot: { current: "start" },
      timestamp: Date.now()
    } as const;

    windowListener(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: bridgeEnvelope
      })
    );

    expect(sendMessage).toHaveBeenCalledWith({ type: "bridge-envelope", envelope: bridgeEnvelope });

    const extensionEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "command",
      machineId: "machine-1",
      requestId: "req-1",
      command: { type: "next" },
      timestamp: Date.now()
    } as const;

    runtime({ type: "extension-envelope", envelope: extensionEnvelope });
    expect(postMessage).toHaveBeenCalledWith(extensionEnvelope, window.location.origin);
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
          snapshot: { current: "start" },
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
          snapshot: { current: "start" },
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
          command: { type: "next" },
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
        snapshot: { current: "start" },
        timestamp: Date.now()
      }
    });

    expect(postMessage).not.toHaveBeenCalled();
  });
});
