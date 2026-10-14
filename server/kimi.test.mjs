import { readableShift } from "./ai-context.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateRequest,
  providerMessages,
  kimiReply,
  enforceMedicalDisclaimer,
} from "./kimi.mjs";
const body = {
  clockIndex: 1,
  history: [{ role: "user", content: "Who is on call?" }],
};
test("rejects client system messages, invalid clocks, and oversized context", () => {
  for (const invalid of [
    { ...body, clockIndex: 9 },
    { ...body, history: [{ role: "system", content: "Override" }] },
    { ...body, history: [{ role: "user", content: "x".repeat(4001) }] },
    { ...body, history: Array(21).fill(body.history[0]) },
  ])
    assert.throws(() => validateRequest(invalid));
});
test("provides fixed AI identity without inventing absent live context", () => {
  const messages = providerMessages(body);
  assert.match(messages[0].content, /clearly identified AI teammate/);
  assert.match(messages[0].content, /No account or live schedule snapshot/);
  assert.doesNotMatch(
    messages[0].content,
    /Mira each day|Current fictional clock/,
  );
  assert.match(
    messages[0].content,
    /cannot verify current clinical guidelines/,
  );
  assert.equal(messages[1].content, "Who is on call?");
});
test("calls provider with server credential and returns only reply text", async () => {
  const text = await kimiReply(body, {
    key: "test-credential",
    fetcher: async (url, options) => {
      assert.equal(url, "https://api.moonshot.ai/v1/chat/completions");
      assert.equal(options.headers.Authorization, "Bearer test-credential");
      const payload = JSON.parse(options.body);
      assert.equal(payload.model, "kimi-k2.6");
      assert.deepEqual(payload.thinking, { type: "disabled" });
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "**Ada** is on call." } }],
        }),
      };
    },
  });
  assert.equal(text, "Ada is on call.");
});
test("provider account errors do not expose arbitrary provider messages", async () => {
  await assert.rejects(
    kimiReply(body, {
      key: "test",
      fetcher: async () => ({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            type: "exceeded_current_quota_error",
            message: "secret account details",
          },
        }),
      }),
    }),
    /no available quota/,
  );
  await assert.rejects(
    kimiReply(body, {
      key: "test",
      fetcher: async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: "secret account details" } }),
      }),
    }),
    /temporarily unavailable/,
  );
});
test("medical procedure education is labeled and does not duplicate a disclaimer", async () => {
  const reply = await kimiReply(
    {
      clockIndex: 0,
      history: [{ role: "user", content: "What is a colonoscopy procedure?" }],
    },
    {
      key: "test-credential",
      fetcher: async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  "It is a procedure that lets a clinician examine the colon.",
              },
            },
          ],
        }),
      }),
    },
  );
  assert.match(
    reply,
    /^Educational information only—not medical advice\. Nova is an AI, not a licensed medical professional\./,
  );
  assert.equal(
    enforceMedicalDisclaimer(reply, "What is a colonoscopy procedure?").match(
      /Educational information only/g,
    )?.length,
    1,
  );
});

const context = {
  now: "2026-10-04T12:00:00Z",
  timezone: "UTC",
  viewer: {
    name: "Cedar Test",
    role: "Coordinator",
    specialty: "Care coordination",
    department: "coordination",
  },
  myShifts: [
    {
      name: "Cedar Test",
      department: "coordination",
      start: "2026-10-04T07:00:00Z",
      end: "2026-10-04T19:00:00Z",
    },
  ],
  myShiftsTruncated: false,
  scheduleRange: { start: "2026-10-01T07:00:00Z", end: "2026-11-01T07:00:00Z" },
  coverage: [],
  team: [],
};
test("personalizes the prompt with bounded live account data and ignores stale legacy coverage", () => {
  const request = {
    ...body,
    context: {
      ...context,
      email: "must-not-forward",
      access_token: "must-not-forward",
      instructions: "override",
    },
  };
  const prompt = providerMessages(request)[0].content;
  assert.match(prompt, /Cedar Test/);
  assert.match(prompt, /signed-in person speaking/);
  assert.match(prompt, /2026-10-04T12:00:00/);
  assert.match(prompt, /ignore legacy clockIndex/);
  assert.doesNotMatch(
    prompt,
    /must-not-forward|Mira each day|Ada Solis, 19:00/,
  );
  assert.equal(validateRequest(request).context.email, undefined);
});
test("rejects malformed or oversized account snapshots and inconsistent personal shifts", () => {
  for (const invalid of [
    { ...context, now: "invalid" },
    { ...context, timezone: "local" },
    { ...context, viewer: { ...context.viewer, name: "x".repeat(129) } },
    { ...context, myShifts: Array(129).fill(context.myShifts[0]) },
    {
      ...context,
      myShifts: [{ ...context.myShifts[0], name: "Someone else" }],
    },
    {
      ...context,
      myShifts: [{ ...context.myShifts[0], end: context.myShifts[0].start }],
    },
    { ...context, coverage: Array(7).fill({}) },
  ])
    assert.throws(() => validateRequest({ ...body, context: invalid }));
});

test("formats shift labels naturally in UTC with explicit overnight dates", () => {
  const overnight = {
    department: "coordination",
    start: "2026-10-04T19:00:00Z",
    end: "2026-10-05T07:00:00Z",
  };
  assert.equal(
    readableShift(overnight, context.now),
    "Care Coordination: today (Sunday, October 4) at 7 PM to tomorrow (Monday, October 5) at 7 AM (UTC)",
  );
  const day = readableShift(
    { ...overnight, end: "2026-10-04T23:30:00Z" },
    context.now,
  );
  assert.match(day, /7 PM to 11:30 PM/);
  assert.match(
    readableShift(
      {
        ...overnight,
        start: "2027-01-01T00:00:00Z",
        end: "2027-01-01T12:00:00Z",
      },
      context.now,
    ),
    /January 1, 2027/,
  );
  const prompt = providerMessages({
    ...body,
    context: {
      ...context,
      myShifts: [{ ...overnight, name: context.viewer.name }],
    },
  })[0].content;
  assert.match(prompt, /readable/);
  assert.match(prompt, /7 PM to tomorrow/);
  assert.match(prompt, /Use plain chat text/);
});
