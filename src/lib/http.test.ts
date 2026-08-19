import { describe, expect, it } from "vitest";
import { readJsonResponse } from "@/lib/http";

describe("JSON response handling", () => {
  it("parses valid JSON", async () => {
    await expect(readJsonResponse(Response.json({ ok: true }))).resolves.toEqual({ ok: true });
  });

  it("reports an empty response without exposing a JSON parser error", async () => {
    await expect(readJsonResponse(new Response("", { status: 500 }))).rejects.toThrow(
      "empty server response (HTTP 500)",
    );
  });

  it("reports a non-JSON response clearly", async () => {
    await expect(readJsonResponse(new Response("Internal Server Error", { status: 500 }))).rejects.toThrow(
      "invalid server response (HTTP 500)",
    );
  });
});
