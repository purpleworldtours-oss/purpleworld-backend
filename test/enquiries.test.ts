// POST /api/enquiries with Resend and MongoDB stubbed out: no real email is
// sent and no database is needed. Run with `npm test`.
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, mock, test } from "node:test";

const API_KEY = "re_test_secret_key";
Object.assign(process.env, {
  MONGODB_URI: "mongodb://127.0.0.1:1/unused",
  JWT_SECRET: "test-secret",
  CLOUDINARY_CLOUD_NAME: "test",
  CLOUDINARY_API_KEY: "test",
  CLOUDINARY_API_SECRET: "test",
  RESEND_API_KEY: API_KEY,
  ENQUIRY_TO_EMAIL: "owner@example.com",
  ENQUIRY_FROM_EMAIL: "Enquiries <enquiries@example.com>",
  // Lets each test use its own IP so the rate limit doesn't carry over
  TRUST_PROXY: "1",
});

const { createApp } = await import("../src/app.js");
const { Enquiry } = await import("../src/models/Enquiry.js");

const realFetch = globalThis.fetch;
let baseUrl = "";
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let resendResponse: () => Promise<Response>;
let resendCalls: { url: string; body: Record<string, unknown>; headers: Headers }[];
let saved: unknown[];
let logs: string[];
let ip = 0;

const valid = {
  fullName: "Asha Menon",
  phone: "+91 98765 43210",
  travelDate: "2026-12-20",
  destination: "Kerala",
  budget: "₹50,000 – ₹1,00,000",
  travelers: 2,
  notes: "Houseboat stay please",
  website: "",
};

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // Intercept every call Resend makes; requests to our own server go through
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith(baseUrl)) return realFetch(input, init);
    resendCalls.push({ url, body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    return resendResponse();
  });
  mock.method(Enquiry, "create", async (doc: unknown) => {
    saved.push(doc);
    return doc;
  });
  mock.method(console, "error", (...args: unknown[]) => logs.push(args.map(String).join(" ")));
});

after(() => {
  mock.restoreAll();
  server.close();
});

beforeEach(() => {
  resendResponse = async () => Response.json({ id: "email_123" });
  resendCalls = [];
  saved = [];
  logs = [];
  ip++;
});

function post(body: unknown, { raw = false, forIp = `10.0.0.${ip}` } = {}) {
  return realFetch(`${baseUrl}/api/enquiries`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": forIp },
    body: raw ? String(body) : JSON.stringify(body),
  });
}

test("valid enquiry is emailed to the configured recipient and saved", async () => {
  const res = await post(valid);
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { ok: true });

  assert.equal(resendCalls.length, 1);
  const [{ url, body }] = resendCalls;
  assert.equal(url, "https://api.resend.com/emails");
  assert.deepEqual(body.to, "owner@example.com");
  assert.equal(body.from, "Enquiries <enquiries@example.com>");
  assert.match(String(body.subject), /Asha Menon/);
  for (const value of ["Asha Menon", "+91 98765 43210", "2026-12-20", "Kerala", "₹50,000 – ₹1,00,000", "Houseboat stay please"]) {
    assert.ok(String(body.text).includes(value), `email text includes ${value}`);
  }
  assert.equal(saved.length, 1);
});

test("recipient can't be overridden by the browser", async () => {
  const res = await post({ ...valid, to: "attacker@example.com", recipient: "attacker@example.com" });
  assert.equal(res.status, 201);
  assert.equal(resendCalls[0].body.to, "owner@example.com");
  assert.ok(!JSON.stringify(resendCalls[0].body).includes("attacker"));
});

test("missing fields are rejected with field messages", async () => {
  const res = await post({ fullName: "Asha" });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "Validation failed");
  assert.equal(data.fields.phone, "Enter your phone number");
  assert.equal(data.fields.destination, "Choose a destination");
  assert.equal(resendCalls.length, 0);
  assert.equal(saved.length, 0);
});

test("invalid and overlong values are rejected", async () => {
  const cases = [
    { phone: "not a phone" },
    { travelDate: "next week" },
    { travelers: 0 },
    { travelers: 101 },
    { fullName: "x".repeat(101) },
    { notes: "x".repeat(2001) },
  ];
  for (const [i, bad] of cases.entries()) {
    const res = await post({ ...valid, ...bad }, { forIp: `10.1.0.${i}` });
    assert.equal(res.status, 400, `rejects ${JSON.stringify(bad).slice(0, 40)}`);
  }
  assert.equal(resendCalls.length, 0);
});

test("malformed JSON and empty bodies are rejected", async () => {
  const malformed = await post("{not json", { raw: true });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: "Invalid request body" });

  const empty = await realFetch(`${baseUrl}/api/enquiries`, {
    method: "POST",
    headers: { "x-forwarded-for": `10.2.0.${ip}` },
  });
  assert.equal(empty.status, 400);
  assert.equal(resendCalls.length, 0);
});

test("honeypot submissions get a fake success and send nothing", async () => {
  const res = await post({ ...valid, website: "http://spam.example" });
  assert.equal(res.status, 201);
  assert.equal(resendCalls.length, 0);
  assert.equal(saved.length, 0);
});

test("Resend API error returns a safe 502 and saves nothing", async () => {
  resendResponse = async () =>
    Response.json({ name: "validation_error", message: "Domain not verified", statusCode: 403 }, { status: 403 });
  const res = await post(valid);
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.equal(data.error, "We couldn't send your request right now. Please try again, or call us.");
  assert.ok(!JSON.stringify(data).includes("Domain"), "provider detail not exposed");
  assert.equal(saved.length, 0);
  assert.ok(logs.some((l) => l.includes("Domain not verified")), "failure is logged on the server");
  assert.ok(!logs.some((l) => l.includes(API_KEY)), "API key never logged");
});

test("network failure reaching Resend returns 502", async () => {
  resendResponse = async () => {
    throw new TypeError("fetch failed");
  };
  const res = await post(valid);
  assert.equal(res.status, 502);
  assert.equal(saved.length, 0);
  assert.ok(!logs.some((l) => l.includes(API_KEY)));
});

test("submissions are rate limited per IP", async () => {
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await post(valid, { forIp: "10.9.9.9" })).status);
  assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
  assert.equal(resendCalls.length, 5);
});
