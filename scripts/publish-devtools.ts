import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

type AccessTokenResponse = {
  access_token?: string;
};

type UploadResponse = {
  name?: string;
  itemId?: string;
  crxVersion?: string;
  uploadState?: string;
  [key: string]: unknown;
};

type PublishResponse = {
  status?: string[];
  [key: string]: unknown;
};

type RequestOptions = NonNullable<Parameters<typeof fetch>[1]>;
type EnvShape = Record<string, string | undefined>;

const explainFailure = (body: unknown, fallbackMessage: string): string => {
  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (!body || typeof body !== "object") {
    return fallbackMessage;
  }

  const record = body as Record<string, unknown>;
  const nestedError = record.error;

  if (typeof record.error_description === "string" && record.error_description.trim()) {
    return record.error_description;
  }

  if (typeof nestedError === "string" && nestedError.trim()) {
    return nestedError;
  }

  if (nestedError && typeof nestedError === "object") {
    const nestedRecord = nestedError as Record<string, unknown>;
    const nestedMessage = nestedRecord.message;
    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  return fallbackMessage;
};

const readPayload = async <T>(response: Response): Promise<T | string | undefined> => {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text;
  }
};

const requestJson = async <T>(label: string, url: string, init: RequestOptions): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    const wrappedError = new Error(`${label}: ${(error as Error).message}`) as Error & {
      cause?: unknown;
    };
    wrappedError.cause = error;
    throw wrappedError;
  }

  const responseBody = await readPayload<T>(response);

  if (!response.ok) {
    throw new Error(
      `${label}: ${explainFailure(responseBody, response.statusText || "Request failed")}`
    );
  }

  if (responseBody === undefined) {
    throw new Error(`${label}: Empty response body`);
  }

  return responseBody as T;
};

const exchangeRefreshToken = async (input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<string> => {
  const response = await requestJson<AccessTokenResponse>(
    "Failed to get access token",
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        refresh_token: input.refreshToken,
        grant_type: "refresh_token"
      })
    }
  );

  if (!response.access_token) {
    throw new Error("Failed to get access token: No access_token in response");
  }

  return response.access_token;
};

const createHeaders = (token: string, fileName: string): Record<string, string> => {
  return {
    Authorization: `Bearer ${token}`,
    "x-goog-api-version": "2",
    "Content-Type": "application/zip",
    "X-Goog-Upload-Protocol": "raw",
    "X-Goog-Upload-File-Name": fileName
  };
};

const pushBundle = async (input: {
  publisherId: string;
  extensionId: string;
  accessToken: string;
  zipFilePath: string;
}): Promise<void> => {
  const fileBuffer = fs.readFileSync(input.zipFilePath);
  const fileName = path.basename(input.zipFilePath);

  const response = await requestJson<UploadResponse>(
    "Failed to upload extension",
    `https://chromewebstore.googleapis.com/upload/v2/publishers/${input.publisherId}/items/${input.extensionId}:upload`,
    {
      method: "POST",
      headers: createHeaders(input.accessToken, fileName),
      body: fileBuffer
    }
  );

  if (!response.uploadState || response.uploadState === "FAILURE") {
    throw new Error(`Upload failed: ${JSON.stringify(response)}`);
  }
};

const finalizeListing = async (
  publisherId: string,
  extensionId: string,
  accessToken: string
): Promise<void> => {
  const response = await requestJson<PublishResponse>(
    "Failed to publish extension",
    `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    }
  );

  if (!response.status || !response.status.includes("OK")) {
    throw new Error(`Publish failed: ${JSON.stringify(response)}`);
  }
};

export const main = async (env: EnvShape = process.env): Promise<void> => {
  const publisherId = env.CWS_PUBLISHER_ID?.trim();
  if (!publisherId) {
    throw new Error("Missing required env: CWS_PUBLISHER_ID");
  }

  const extensionId = env.CWS_EXTENSION_ID?.trim();
  if (!extensionId) {
    throw new Error("Missing required env: CWS_EXTENSION_ID");
  }

  const clientId = env.CWS_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("Missing required env: CWS_CLIENT_ID");
  }

  const clientSecret = env.CWS_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    throw new Error("Missing required env: CWS_CLIENT_SECRET");
  }

  const refreshToken = env.CWS_REFRESH_TOKEN?.trim();
  if (!refreshToken) {
    throw new Error("Missing required env: CWS_REFRESH_TOKEN");
  }

  const zipFilePath = env.ZIP_FILE_PATH?.trim() || "apps-devtools.zip";

  console.log("Requesting access token...");
  const accessToken = await exchangeRefreshToken({
    clientId,
    clientSecret,
    refreshToken
  });

  console.log("Uploading extension zip...");
  await pushBundle({ publisherId, extensionId, accessToken, zipFilePath });

  console.log("Publishing extension...");
  await finalizeListing(publisherId, extensionId, accessToken);

  console.log("Chrome Web Store publish completed.");
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
