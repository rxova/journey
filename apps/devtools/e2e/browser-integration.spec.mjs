import path from "node:path";
import { writeFile } from "node:fs/promises";
import { chromium, expect, test } from "@playwright/test";

const EXTENSION_PATH = path.join(process.cwd(), "apps/devtools/dist");
const PANEL_PORT_NAME = "rxova-journey-devtools-panel";

test.setTimeout(90_000);

test("surfaces restricted-tab injection warning and clears for follow-up tab session", async ({
  browserName
}, testInfo) => {
  const isCi = process.env.CI === "true";
  void browserName;
  const diagnosticsLogs = [];
  let context;
  let harnessPage = null;
  let tracingStarted = false;

  const launchWith = async (headless) =>
    await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless,
      timeout: 15_000,
      recordVideo: {
        dir: testInfo.outputPath("videos"),
        size: { width: 1280, height: 720 }
      },
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`]
    });

  const stopTracing = async (failed) => {
    if (!context || !tracingStarted) {
      return;
    }

    if (failed) {
      const tracePath = testInfo.outputPath("browser-integration-trace.zip");
      await context.tracing.stop({ path: tracePath });
      await testInfo.attach("browser-integration-trace", {
        path: tracePath,
        contentType: "application/zip"
      });
      return;
    }

    await context.tracing.stop();
  };

  const attachConsoleLogs = async (failed) => {
    if (diagnosticsLogs.length === 0) {
      return;
    }

    const logPath = testInfo.outputPath("browser-integration-console.log");
    await writeFile(logPath, diagnosticsLogs.join("\n"), "utf8");
    if (failed) {
      await testInfo.attach("browser-integration-console", {
        path: logPath,
        contentType: "text/plain"
      });
    }
  };

  const attachVideo = async (failed) => {
    if (!failed || !harnessPage) {
      return;
    }
    const video = harnessPage.video();
    if (!video) {
      return;
    }

    try {
      const videoPath = await video.path();
      await testInfo.attach("browser-integration-video", {
        path: videoPath,
        contentType: "video/webm"
      });
    } catch {
      diagnosticsLogs.push("[video] Unable to resolve recorded video path.");
    }
  };

  try {
    context = await launchWith(false);
  } catch {
    context = await launchWith(true);
  }

  try {
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true
    });
    tracingStarted = true;

    let serviceWorker = context.serviceWorkers()[0] ?? null;
    if (!serviceWorker) {
      try {
        serviceWorker = await context.waitForEvent("serviceworker", {
          timeout: 15_000
        });
      } catch {
        const message =
          "Extension service worker is unavailable in this browser environment. Browser integration was not fully executed.";
        diagnosticsLogs.push(`[service-worker] ${message}`);
        if (isCi) {
          throw new Error(
            "Extension service worker is unavailable in CI. Browser integration test must not skip."
          );
        }
        console.warn(message);
        test.skip(true, message);
      }
    }
    if (!serviceWorker) {
      return;
    }
    const extensionId = serviceWorker.url().split("/")[2];
    harnessPage = await context.newPage();
    harnessPage.on("console", (message) => {
      diagnosticsLogs.push(`[console:${message.type()}] ${message.text()}`);
    });
    harnessPage.on("pageerror", (error) => {
      diagnosticsLogs.push(`[pageerror] ${String(error)}`);
    });
    await harnessPage.goto(`chrome-extension://${extensionId}/integration-harness.html`);

    const result = await harnessPage.evaluate(
      async ({ panelPortName }) => {
        const chromeApi = globalThis.chrome;
        if (!chromeApi) {
          throw new Error("Chrome extension APIs are unavailable in harness page.");
        }

        const waitForFirstWarning = async (tabId) =>
          await new Promise((resolve, reject) => {
            const port = chromeApi.runtime.connect({ name: panelPortName });
            const timeoutId = window.setTimeout(() => {
              port.disconnect();
              reject(new Error("Timed out waiting for first panel warning"));
            }, 8_000);

            port.onMessage.addListener((message) => {
              if (message?.type === "panel-warning") {
                window.clearTimeout(timeoutId);
                port.disconnect();
                resolve(message.warning ?? null);
              }
            });

            port.postMessage({
              type: "panel-init",
              tabId
            });
          });

        const waitForNonNullWarning = async (tabId) =>
          await new Promise((resolve, reject) => {
            const port = chromeApi.runtime.connect({ name: panelPortName });
            const timeoutId = window.setTimeout(() => {
              port.disconnect();
              reject(new Error("Timed out waiting for non-null panel warning"));
            }, 8_000);

            port.onMessage.addListener((message) => {
              if (message?.type === "panel-warning" && message.warning !== null) {
                window.clearTimeout(timeoutId);
                port.disconnect();
                resolve(message.warning);
              }
            });

            port.postMessage({
              type: "panel-init",
              tabId
            });
          });

        const currentTabId = await new Promise((resolve, reject) => {
          const timeoutId = window.setTimeout(() => {
            reject(new Error("Timed out resolving active tab"));
          }, 8_000);

          chromeApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            window.clearTimeout(timeoutId);
            const runtimeError = chromeApi.runtime.lastError;
            if (runtimeError) {
              reject(new Error(runtimeError.message));
              return;
            }

            const tabId = tabs[0]?.id;
            if (!tabId) {
              reject(new Error("Active tab ID was not returned"));
              return;
            }
            resolve(tabId);
          });
        });

        const restrictedWarning = await waitForNonNullWarning(9_999_999);
        const allowedWarning = await waitForFirstWarning(currentTabId);

        return {
          restrictedWarning,
          allowedWarning
        };
      },
      { panelPortName: PANEL_PORT_NAME }
    );

    expect(result.restrictedWarning).not.toBeNull();
    expect(result.restrictedWarning.code).toBe("injection-failed");
    expect(result.allowedWarning).toBeNull();
  } finally {
    const failed = testInfo.status !== testInfo.expectedStatus;
    await attachConsoleLogs(failed);
    await stopTracing(failed);
    await context.close();
    await attachVideo(failed);
  }
});
