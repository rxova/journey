import path from "node:path";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, "../dist");
const HARNESS_PATH = "src/integration-harness.html";
const PANEL_PORT_NAME = "rxova-journey-devtools-panel";

test.setTimeout(90_000);

test("surfaces restricted-tab injection warning and clears for follow-up tab session", async ({
  browserName
}, testInfo) => {
  const isCi = process.env.CI === "true";
  const isLinux = process.platform === "linux";
  void browserName;
  const diagnosticsLogs = [];
  let context;
  let harnessPage = null;
  let allowedPage = null;
  let server = null;
  let allowedUrl: string;
  let tracingStarted = false;

  const launchWith = async (headless) =>
    await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless,
      timeout: isCi ? 60_000 : 20_000,
      recordVideo: {
        dir: testInfo.outputPath("videos"),
        size: { width: 1280, height: 720 }
      },
      args: [
        ...(isLinux ? ["--disable-gpu"] : []),
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`
      ]
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
    const videoPage = harnessPage ?? allowedPage;
    if (!failed || !videoPage) {
      return;
    }
    const video = videoPage.video();
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

  if (!existsSync(EXTENSION_PATH)) {
    throw new Error(`Built extension directory not found: ${EXTENSION_PATH}`);
  }
  if (!existsSync(path.join(EXTENSION_PATH, HARNESS_PATH))) {
    throw new Error(
      `Built integration harness not found: ${path.join(EXTENSION_PATH, HARNESS_PATH)}`
    );
  }

  try {
    context = await launchWith(false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    diagnosticsLogs.push(`[launch] Headed Chromium launch failed: ${message}`);

    if (isCi) {
      throw new Error(`Headed Chromium launch failed in CI: ${message}`, { cause: error });
    }

    test.skip(
      true,
      "Browser integration requires a headed Chromium session with extension support. Run it from a desktop session or under xvfb-run."
    );
    return;
  }

  try {
    server = await new Promise((resolve, reject) => {
      const httpServer = createServer((_request, response) => {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end("<!doctype html><html><body><main>allowed</main></body></html>");
      });

      httpServer.once("error", reject);
      httpServer.listen(0, "127.0.0.1", () => resolve(httpServer));
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve localhost server address for browser integration test.");
    }
    allowedUrl = `http://127.0.0.1:${address.port}/allowed`;

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
    allowedPage = await context.newPage();
    allowedPage.on("console", (message) => {
      diagnosticsLogs.push(`[allowed-page:${message.type()}] ${message.text()}`);
    });
    await allowedPage.goto(allowedUrl);
    await allowedPage.bringToFront();

    harnessPage = await context.newPage();
    harnessPage.on("console", (message) => {
      diagnosticsLogs.push(`[console:${message.type()}] ${message.text()}`);
    });
    harnessPage.on("pageerror", (error) => {
      diagnosticsLogs.push(`[pageerror] ${String(error)}`);
    });
    await harnessPage.goto(`chrome-extension://${extensionId}/${HARNESS_PATH}`);

    const result = await harnessPage.evaluate(
      async ({ panelPortName, allowedTabUrl }) => {
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
            reject(new Error(`Timed out resolving allowed tab for ${allowedTabUrl}`));
          }, 8_000);

          chromeApi.tabs.query({ url: [allowedTabUrl] }, (tabs) => {
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
      { panelPortName: PANEL_PORT_NAME, allowedTabUrl: allowedUrl }
    );

    expect(result.restrictedWarning).not.toBeNull();
    expect(result.restrictedWarning.code).toBe("injection-failed");
    expect(result.allowedWarning).toBeNull();
  } finally {
    const failed = testInfo.status !== testInfo.expectedStatus;
    await attachConsoleLogs(failed);
    await stopTracing(failed);
    await context.close();
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(undefined);
        });
      });
    }
    await attachVideo(failed);
  }
});
