import { NextRequest } from "next/server";

const upstreamOrigin = (process.env.VISMUSE_API_ORIGIN || "https://vismuse.com").replace(/\/+$/, "");

function buildUpstreamUrl(request: NextRequest, segments: string[]): URL {
  const upstreamUrl = new URL(
    `/api/${segments.map(encodeURIComponent).join("/")}`,
    upstreamOrigin
  );
  upstreamUrl.search = request.nextUrl.search;
  return upstreamUrl;
}

function buildUpstreamHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  for (const header of [
    "host",
    "content-length",
    "connection",
    "accept-encoding",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-forwarded-port",
    "x-vismuse-client-origin",
    "x-flyermaker-origin"
  ]) {
    headers.delete(header);
  }

  const origin = new URL(
    process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin
  ).origin;

  headers.delete("x-flyermaker-client");
  headers.set("x-vismuse-client", "hotel-lobby-ai");
  headers.set("x-forwarded-host", request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
  headers.set("x-vismuse-client-origin", origin);
  return headers;
}

function buildClientHeaders(upstream: Response, clientOrigin: string): Headers {
  const headers = new Headers(upstream.headers);
  for (const header of [
    "content-encoding",
    "content-length",
    "transfer-encoding",
    "connection",
    "x-frame-options",
    "content-security-policy"
  ]) {
    headers.delete(header);
  }

  const location = headers.get("location");
  if (location) {
    try {
      const redirectUrl = new URL(location, upstreamOrigin);
      if (redirectUrl.origin === upstreamOrigin) {
        headers.set("location", `${clientOrigin}${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`);
      }
    } catch {
      // Preserve an opaque or non-URL Location header from the upstream.
    }
  }

  headers.set("cache-control", "private, no-store");
  return headers;
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  let upstream: Response;
  try {
  upstream = await fetch(buildUpstreamUrl(request, path), {
    method: request.method,
    headers: buildUpstreamHeaders(request),
    body: request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer(),
    redirect: "manual",
    cache: "no-store"
  });
  } catch {
    return Response.json({ error: "The video service is temporarily unavailable. Please try again." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: buildClientHeaders(upstream, request.nextUrl.origin)
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;

export const HEAD = proxy;
