import test from "node:test";
import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import { validateRequest, kimiReply, providerMessages } from "./kimi.mjs";
import { resolveVisionImages, boundedImage } from "./vision.mjs";
import { VISION_FIXTURES } from "./vision-fixtures.mjs";
const path = "conversation-1/viewer/photo.png";
const body = (
  image = { attachmentId: "device-photo", entryId: "image-1", imagePath: path },
) => ({
  clockIndex: 0,
  conversationId: "conversation-1",
  history: [{ role: "user", content: "Summarize this board.", image }],
});
const png = Buffer.from(
  VISION_FIXTURES["handoff-board"].split(",")[1],
  "base64",
);
const row = {
  id: "conversation-1",
  owner_id: "viewer",
  recipient_id: "nova",
  payload: {
    chat: [
      {
        id: "image-1",
        senderId: "viewer",
        kind: "image",
        attachmentId: "device-photo",
        imagePath: path,
      },
    ],
  },
};
const options = {
  base: "https://database.example",
  key: "public-key",
  authorization: "Bearer viewer-token",
  userId: "viewer",
};
test("image references reject URLs, traversal, assistant images, missing conversation and excess images", () => {
  for (const image of [
    {
      attachmentId: "device-photo",
      entryId: "a",
      imagePath: "https://evil.test/file",
    },
    { attachmentId: "device-photo", entryId: "a", imagePath: "../secret.png" },
    { attachmentId: "handoff-board", entryId: "a", url: "https://evil.test" },
  ])
    assert.throws(() => validateRequest(body(image)));
  assert.throws(() =>
    validateRequest({ ...body(), conversationId: undefined }),
  );
  assert.throws(() =>
    validateRequest({
      ...body(),
      history: [
        { ...body().history[0], role: "assistant" },
        { role: "user", content: "Hi" },
      ],
    }),
  );
  assert.throws(() =>
    validateRequest({ ...body(), history: Array(4).fill(body().history[0]) }),
  );
});
test("authorized photos use persisted attachment and user permissions without exposing storage URL to provider", async () => {
  const urls = [];
  const images = await resolveVisionImages(validateRequest(body()), {
    ...options,
    fetcher: async (url, init) => {
      urls.push(url);
      assert.equal(init.headers.Authorization, "Bearer viewer-token");
      assert.equal(init.redirect, "manual");
      return url.includes("/rest/")
        ? Response.json([row])
        : new Response(png, { headers: { "Content-Type": "image/png" } });
    },
  });
  assert.equal(urls.length, 2);
  assert(
    urls[1].startsWith(
      "https://database.example/storage/v1/object/authenticated/shiftline-photos/",
    ),
  );
  assert.equal(images.get("image-1"), VISION_FIXTURES["handoff-board"]);
});
test("foreign, missing, resolved and forged attachments are denied before downloading", async () => {
  for (const record of [
    undefined,
    { ...row, owner_id: "stranger" },
    {
      ...row,
      payload: { ...row.payload, resolvedAt: new Date().toISOString() },
    },
    { ...row, payload: { chat: [] } },
    {
      ...row,
      payload: {
        chat: [{ ...row.payload.chat[0], imagePath: "other/photo.png" }],
      },
    },
  ]) {
    let calls = 0;
    await assert.rejects(
      resolveVisionImages(validateRequest(body()), {
        ...options,
        fetcher: async () => {
          calls++;
          return Response.json(record ? [record] : []);
        },
      }),
      /cannot analyze|not part/,
    );
    assert.equal(calls, 1);
  }
});
test("storage permission failures do not fall back to public downloads", async () => {
  let calls = 0;
  await assert.rejects(
    resolveVisionImages(validateRequest(body()), {
      ...options,
      fetcher: async () => {
        calls++;
        return calls === 1
          ? Response.json([row])
          : new Response("", { status: 403 });
      },
    }),
    /Photo unavailable/,
  );
  assert.equal(calls, 2);
});
test("oversized streams, unsupported MIME and spoofed image content are rejected", async () => {
  await assert.rejects(
    boundedImage(
      new Response(png, { headers: { "content-type": "image/heic" } }),
      8e6,
    ),
    /JPEG/,
  );
  await assert.rejects(
    boundedImage(
      new Response("<html>bad</html>", {
        headers: { "content-type": "image/png" },
      }),
      8e6,
    ),
    /format/,
  );
  await assert.rejects(
    boundedImage(
      new Response(new Uint8Array(100), {
        headers: { "content-type": "image/png" },
      }),
      50,
    ),
    /too large/,
  );
  await assert.rejects(
    boundedImage(
      new Response(png, {
        headers: { "content-type": "image/png", "content-length": "9000000" },
      }),
      8e6,
    ),
    /4 MB/,
  );
});
test("built-in board is sent as actual visual content with Kimi vision model and source instructions", async () => {
  const request = validateRequest(
    body({ attachmentId: "handoff-board", entryId: "board" }),
  );
  const images = await resolveVisionImages(request);
  let payload;
  await kimiReply(request, {
    key: "fake-test-key",
    images,
    fetcher: async (url, init) => {
      payload = JSON.parse(init.body);
      return Response.json({
        choices: [{ message: { content: "The board lists three items." } }],
      });
    },
  });
  assert.equal(payload.model, "kimi-k2.6");
  assert.equal(payload.messages.at(-1).content[1].type, "image_url");
  assert.equal(
    payload.messages.at(-1).content[1].image_url.url,
    VISION_FIXTURES["handoff-board"],
  );
  assert.match(payload.messages[0].content, /untrusted source material/);
  assert.match(payload.messages[0].content, /blurry or unreadable/);
});

test("older attachment placeholders fail clearly instead of producing a false capability denial", () => {
  assert.throws(
    () =>
      validateRequest({
        clockIndex: 0,
        history: [
          {
            role: "user",
            content:
              "[Shared photo attachment, image not analyzed: device-photo] Read this",
          },
        ],
      }),
    /Refresh the app and reattach/,
  );
});
test("a stale capability denial is corrected once while retaining the actual pixels", async () => {
  const request = validateRequest(
    body({ attachmentId: "handoff-board", entryId: "board" }),
  );
  const images = await resolveVisionImages(request);
  let calls = 0;
  const reply = await kimiReply(request, {
    key: "fake-test-key",
    images,
    fetcher: async (url, init) => {
      const payload = JSON.parse(init.body);
      calls++;
      assert.match(payload.messages[0].content, /1 actual image/);
      assert(
        payload.messages.some(
          (message) =>
            Array.isArray(message.content) &&
            message.content.some((part) => part.type === "image_url"),
        ),
      );
      return Response.json({
        choices: [
          {
            message: {
              content:
                calls === 1
                  ? "I can't see images or attachments."
                  : "The board says Huddle at 19:30.",
            },
          },
        ],
      });
    },
  });
  assert.equal(calls, 2);
  assert.equal(reply, "The board says Huddle at 19:30.");
});

test("image inspection excludes stale chat denials while retaining all image inputs", async () => {
  const history = [];
  for (let i = 0; i < 6; i++)
    history.push(
      { role: "user", content: "Can you read this?" },
      { role: "assistant", content: "I can't see images or attachments." },
    );
  for (let i = 0; i < 3; i++)
    history.push({
      role: "user",
      content: "Compare these team maps.",
      image: { attachmentId: "team-map", entryId: "map-" + i },
    });
  const request = { clockIndex: 0, conversationId: "inspect-test", history };
  const images = await resolveVisionImages(request);
  const messages = providerMessages(request, images);
  assert.equal(messages.length, 4);
  assert.equal(messages.filter((m) => m.role === "assistant").length, 0);
  assert.equal(messages.filter((m) => Array.isArray(m.content)).length, 3);
  request.history.push({ role: "user", content: "When is my next shift?" });
  assert(providerMessages(request, images).some((m) => m.role === "assistant"));
});

test("can you see it inspects the newest picture with no prior capability denials", async () => {
  const request = {
    clockIndex: 0,
    conversationId: "followup-test",
    history: [
      {
        role: "user",
        content: "[Shared fictional illustration: handoff-board]",
        image: { attachmentId: "handoff-board", entryId: "old-board" },
      },
      { role: "assistant", content: "I can't see images or attachments." },
      {
        role: "user",
        content: "[Shared fictional illustration: team-map]",
        image: { attachmentId: "team-map", entryId: "new-map" },
      },
      { role: "assistant", content: "I can't see images or attachments." },
      { role: "user", content: "Can you see it?" },
    ],
  };
  const images = await resolveVisionImages(request);
  const messages = providerMessages(request, images);
  assert.equal(messages.length, 3);
  assert.equal(messages.filter((m) => m.role === "assistant").length, 0);
  assert.equal(
    messages[1].content[1].image_url.url,
    VISION_FIXTURES["team-map"],
  );
  assert.equal(messages.at(-1).content, "Can you see it?");
  assert.match(messages[0].content, /1 actual image/);
});
