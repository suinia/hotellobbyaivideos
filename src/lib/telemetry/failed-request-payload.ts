export const FAILED_REQUEST_PAYLOAD_MAX_CHARS = 256_000;
export const FAILED_REQUEST_BODY_MAX_BYTES = 256_000;

export type BoundedRequestBody = {
  text: string;
  tooLarge: boolean;
  declaredContentLength?: number;
};

type TruncatedFailedRequestPayload = {
  _telemetryTruncated: true;
  originalLength: number;
  payloadPreview: string;
};

function stringifyPayload(value: unknown): string | undefined {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? serialized : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read only the bounded prefix of an untrusted request body. The caller can
 * still retain a useful failure snapshot without allowing request.text() to
 * allocate an arbitrarily large payload before authentication or validation.
 */
export async function readBoundedRequestBody(
  request: Request,
  maxBytes = FAILED_REQUEST_BODY_MAX_BYTES
): Promise<BoundedRequestBody> {
  const declaredHeader = request.headers.get("content-length")?.trim();
  const declaredValue = declaredHeader ? Number(declaredHeader) : Number.NaN;
  const declaredContentLength = Number.isSafeInteger(declaredValue) && declaredValue >= 0
    ? declaredValue
    : undefined;
  const reader = request.body?.getReader();
  if (!reader) {
    return {
      text: "",
      tooLarge: Boolean(declaredContentLength && declaredContentLength > maxBytes),
      declaredContentLength
    };
  }

  const decoder = new TextDecoder();
  let text = "";
  let retainedBytes = 0;
  let tooLarge = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const remaining = Math.max(0, maxBytes - retainedBytes);
      const retained = value.subarray(0, remaining);
      if (retained.byteLength) {
        text += decoder.decode(retained, { stream: true });
        retainedBytes += retained.byteLength;
      }

      if (value.byteLength > remaining) {
        tooLarge = true;
        await reader.cancel("request body exceeds telemetry-safe limit").catch(() => undefined);
        break;
      }
    }
  } finally {
    text += decoder.decode();
  }

  return {
    text,
    tooLarge: tooLarge || Boolean(declaredContentLength && declaredContentLength > maxBytes),
    declaredContentLength
  };
}

function buildTruncatedPayload(serialized: string): string {
  let low = 0;
  let high = Math.min(serialized.length, FAILED_REQUEST_PAYLOAD_MAX_CHARS);
  let best = JSON.stringify({
    _telemetryTruncated: true,
    originalLength: serialized.length,
    payloadPreview: ""
  } satisfies TruncatedFailedRequestPayload);

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = JSON.stringify({
      _telemetryTruncated: true,
      originalLength: serialized.length,
      payloadPreview: serialized.slice(0, middle)
    } satisfies TruncatedFailedRequestPayload);
    if (candidate.length <= FAILED_REQUEST_PAYLOAD_MAX_CHARS) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return best;
}

/**
 * Serialize the JSON request parameters before any database-dependent work.
 * Normal requests are preserved exactly after JSON parsing. Oversized or
 * invalid requests are reduced to a valid, bounded JSON envelope so telemetry
 * cannot amplify an untrusted request without limit.
 */
export function serializeFailedRequestPayload(
  rawBody: unknown,
  parsedBody?: unknown
): string | undefined {
  const serialized = stringifyPayload(rawBody);
  if (!serialized) return undefined;
  if (serialized.length <= FAILED_REQUEST_PAYLOAD_MAX_CHARS) return serialized;

  const parsedSerialized = parsedBody === undefined ? undefined : stringifyPayload(parsedBody);
  if (parsedSerialized && parsedSerialized.length <= FAILED_REQUEST_PAYLOAD_MAX_CHARS) {
    return parsedSerialized;
  }

  return buildTruncatedPayload(parsedSerialized ?? serialized);
}
