import test from "node:test";
import assert from "node:assert/strict";
import { buildOpenAIRequest, normalizePayload, parseOpenAIResponse } from "../src/server.mjs";

test("normalizes the browser payload", () => {
  const payload = normalizePayload({ guardian_id: "yukawa", user_text: " ありがとう ", facility: { name: "湯処" } });
  assert.equal(payload.guardianId, "yukawa");
  assert.equal(payload.userText, "ありがとう");
  assert.equal(payload.facility.name, "湯処");
});

test("rejects an unknown guardian", () => {
  assert.throws(() => normalizePayload({ guardian_id: "unknown", user_text: "test" }), /Unknown guardian/);
});

test("builds a non-persistent structured Responses request", () => {
  const request = buildOpenAIRequest(normalizePayload({ guardian_id: "izumi", user_text: "疲れました", facility: {} }));
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, "json_schema");
  assert.deepEqual(request.text.format.schema.required, ["reply", "expression"]);
});

test("parses structured output", () => {
  assert.deepEqual(parseOpenAIResponse({ output_text: '{"reply":"今夜はゆっくり休みましょう。","expression":"relaxed"}' }), {
    reply: "今夜はゆっくり休みましょう。", expression: "relaxed"
  });
});
