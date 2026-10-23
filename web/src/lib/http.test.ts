import { describe, expect, it } from "vitest";
import { guardSameOrigin, MAX_BODY_BYTES, readJson, sameOrigin } from "./http";

const req = (headers: Record<string, string>, body?: string) =>
  new Request("https://caniownahome.vercel.app/api/chat", { method: "POST", headers, body });

describe("sameOrigin", () => {
  it("trusts the browser's Sec-Fetch-Site header", () => {
    expect(sameOrigin(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(sameOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("falls back to comparing Origin with Host", () => {
    expect(sameOrigin(req({ origin: "https://caniownahome.vercel.app", host: "caniownahome.vercel.app" }))).toBe(true);
    expect(sameOrigin(req({ origin: "https://evil.example", host: "caniownahome.vercel.app" }))).toBe(false);
  });

  it("refuses requests with neither header, like a bare curl", () => {
    expect(sameOrigin(req({}))).toBe(false);
    expect(guardSameOrigin(req({}))?.status).toBe(403);
  });
});

describe("readJson", () => {
  it("parses a JSON body", async () => {
    const r = await readJson(req({}, '{"a":1}'));
    expect(r.ok && r.body).toEqual({ a: 1 });
  });

  it("rejects bad JSON and oversized bodies", async () => {
    const bad = await readJson(req({}, "nope"));
    expect(!bad.ok && bad.response.status).toBe(400);
    const big = await readJson(req({}, JSON.stringify({ x: "y".repeat(MAX_BODY_BYTES) })));
    expect(!big.ok && big.response.status).toBe(413);
  });
});
