import type * as NodeFs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readFileSyncMock = vi.fn();

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof NodeFs>("node:fs");
  return {
    ...actual,
    readFileSync: readFileSyncMock
  };
});

describe("publish-devtools script", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("publishes a packaged zip using the expected Chrome Web Store flow", async () => {
    readFileSyncMock.mockReturnValue(Buffer.from("zip-bytes"));

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ uploadState: "SUCCESS" }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: ["OK"] }), { status: 200 }));

    const { main } = await import("../tooling/publish-devtools");

    await main({
      CWS_PUBLISHER_ID: "publisher-id",
      CWS_EXTENSION_ID: "extension-id",
      CWS_CLIENT_ID: "client-id",
      CWS_CLIENT_SECRET: "client-secret",
      CWS_REFRESH_TOKEN: "refresh-token",
      ZIP_FILE_PATH: "apps-devtools.zip"
    });

    expect(readFileSyncMock).toHaveBeenCalledWith("apps-devtools.zip");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://chromewebstore.googleapis.com/v2/publishers/publisher-id/items/extension-id:fetchStatus",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token"
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://chromewebstore.googleapis.com/upload/v2/publishers/publisher-id/items/extension-id:upload",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "x-goog-api-version": "2",
          "Content-Type": "application/zip",
          "X-Goog-Upload-Protocol": "raw",
          "X-Goog-Upload-File-Name": "apps-devtools.zip"
        }),
        body: expect.any(Buffer)
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://chromewebstore.googleapis.com/v2/publishers/publisher-id/items/extension-id:publish",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({})
      })
    );
  });

  it("fails early when a required env var is missing", async () => {
    const { main } = await import("../tooling/publish-devtools");

    await expect(
      main({
        CWS_PUBLISHER_ID: "publisher-id",
        CWS_CLIENT_ID: "client-id",
        CWS_CLIENT_SECRET: "client-secret",
        CWS_REFRESH_TOKEN: "refresh-token"
      })
    ).rejects.toThrow("Missing required env: CWS_EXTENSION_ID");
  });

  it("surfaces an upload response that is not marked successful", async () => {
    readFileSyncMock.mockReturnValue(Buffer.from("zip-bytes"));

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ uploadState: "FAILURE", itemError: ["bad"] }), {
          status: 200
        })
      );

    const { main } = await import("../tooling/publish-devtools");

    await expect(
      main({
        CWS_PUBLISHER_ID: "publisher-id",
        CWS_EXTENSION_ID: "extension-id",
        CWS_CLIENT_ID: "client-id",
        CWS_CLIENT_SECRET: "client-secret",
        CWS_REFRESH_TOKEN: "refresh-token"
      })
    ).rejects.toThrow('Upload failed: {"uploadState":"FAILURE","itemError":["bad"]}');
  });

  it("surfaces Google API error messages from failed publish responses", async () => {
    readFileSyncMock.mockReturnValue(Buffer.from("zip-bytes"));

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ uploadState: "SUCCESS" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "publish denied" } }), { status: 403 })
      );

    const { main } = await import("../tooling/publish-devtools");

    await expect(
      main({
        CWS_PUBLISHER_ID: "publisher-id",
        CWS_EXTENSION_ID: "extension-id",
        CWS_CLIENT_ID: "client-id",
        CWS_CLIENT_SECRET: "client-secret",
        CWS_REFRESH_TOKEN: "refresh-token"
      })
    ).rejects.toThrow("Failed to publish extension: publish denied");
  });

  it("fails early when publisher id is missing", async () => {
    const { main } = await import("../tooling/publish-devtools");

    await expect(
      main({
        CWS_EXTENSION_ID: "extension-id",
        CWS_CLIENT_ID: "client-id",
        CWS_CLIENT_SECRET: "client-secret",
        CWS_REFRESH_TOKEN: "refresh-token"
      })
    ).rejects.toThrow("Missing required env: CWS_PUBLISHER_ID");
  });

  it("skips upload and publish when the submitted revision is already pending review", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ submittedItemRevisionStatus: { state: "PENDING_REVIEW" } }), {
          status: 200
        })
      );

    const { main } = await import("../tooling/publish-devtools");

    await main({
      CWS_PUBLISHER_ID: "publisher-id",
      CWS_EXTENSION_ID: "extension-id",
      CWS_CLIENT_ID: "client-id",
      CWS_CLIENT_SECRET: "client-secret",
      CWS_REFRESH_TOKEN: "refresh-token"
    });

    expect(readFileSyncMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats the in-review upload error as a clean skip", async () => {
    readFileSyncMock.mockReturnValue(Buffer.from("zip-bytes"));

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: "You may not edit or publish an item that is in review." }
          }),
          { status: 400 }
        )
      );

    const { main } = await import("../tooling/publish-devtools");

    await main({
      CWS_PUBLISHER_ID: "publisher-id",
      CWS_EXTENSION_ID: "extension-id",
      CWS_CLIENT_ID: "client-id",
      CWS_CLIENT_SECRET: "client-secret",
      CWS_REFRESH_TOKEN: "refresh-token"
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
