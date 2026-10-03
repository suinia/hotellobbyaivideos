import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET, POST, HEAD } from "../src/app/api/[...path]/route";
const context = { params: Promise.resolve({ path: ["v1", "test"] }) };
test("proxy preserves query, auth, guest identity and response cookies", async () => { const original = globalThis.fetch; try {
    globalThis.fetch = async (input, init) => { const url = new URL(String(input)); assert.equal(url.origin, "https://vismuse.com"); assert.equal(url.search, "?source=hotel-lobby-ai"); const headers = new Headers(init?.headers); assert.equal(headers.get("authorization"), "Bearer test-only-token"); assert.equal(headers.get("cookie"), "guest=test-only"); assert.equal(headers.get("x-vismuse-client-origin"), "http://localhost:3018"); assert.equal(headers.get("x-flyermaker-client"), null); return new Response('{"ok":true}', { headers: { "content-type": "application/json", "set-cookie": "guest=canonical; Path=/; HttpOnly" } }); };
    const response = await GET(new NextRequest("http://localhost:3018/api/v1/test?source=hotel-lobby-ai", { headers: { authorization: "Bearer test-only-token", cookie: "guest=test-only", "x-vismuse-client-origin": "https://untrusted.test" } }), context);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("set-cookie"), "guest=canonical; Path=/; HttpOnly");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), { ok: true });
}
finally {
    globalThis.fetch = original;
} });
test("multipart upload bytes and content type pass through unchanged", async () => { const original = globalThis.fetch; try {
    const body = "--test-boundary\r\nphoto bytes\r\n--test-boundary--";
    globalThis.fetch = async (_input, init) => { assert.equal(init?.method, "POST"); assert.equal(new TextDecoder().decode(init?.body as ArrayBuffer), body); assert.equal(new Headers(init?.headers).get("content-type"), "multipart/form-data; boundary=test-boundary"); return new Response('{"uploaded":true}'); };
    assert.equal((await POST(new NextRequest("http://localhost:3018/api/v1/test", { method: "POST", body, headers: { "content-type": "multipart/form-data; boundary=test-boundary" } }), context)).status, 200);
}
finally {
    globalThis.fetch = original;
} });
test("upstream redirects stay local while payment provider redirects remain intact", async () => { const original = globalThis.fetch; try {
    for (const [location, expected] of [["https://vismuse.com/app/chat/example?billing=success", "http://localhost:3018/app/chat/example?billing=success"], ["https://checkout.stripe.com/test-only", "https://checkout.stripe.com/test-only"]]) {
        globalThis.fetch = async () => new Response(null, { status: 307, headers: { location } });
        assert.equal((await GET(new NextRequest("http://localhost:3018/api/v1/test"), context)).headers.get("location"), expected);
    }
}
finally {
    globalThis.fetch = original;
} });
test("upstream failures produce a retryable 502 instead of an unhandled exception", async () => { const original = globalThis.fetch; try {
    globalThis.fetch = async () => { throw new Error("offline"); };
    const response = await GET(new NextRequest("http://localhost:3018/api/v1/test"), context);
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /try again/);
}
finally {
    globalThis.fetch = original;
} });
test("HEAD forwards without a request body", async () => { const original = globalThis.fetch; try {
    globalThis.fetch = async (_input, init) => { assert.equal(init?.method, "HEAD"); assert.equal(init?.body, undefined); return new Response(null, { status: 200 }); };
    assert.equal((await HEAD(new NextRequest("http://localhost:3018/api/v1/test", { method: "HEAD" }), context)).status, 200);
}
finally {
    globalThis.fetch = original;
} });
