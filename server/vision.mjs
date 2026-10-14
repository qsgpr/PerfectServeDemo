import { VISION_FIXTURES } from "./vision-fixtures.mjs";

export class VisionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function validateImageReference(image, role) {
  if (
    !image ||
    role !== "user" ||
    typeof image !== "object" ||
    Object.keys(image).some(
      (key) => !["attachmentId", "entryId", "imagePath"].includes(key),
    ) ||
    !["device-photo", "handoff-board", "team-map"].includes(
      image.attachmentId,
    ) ||
    typeof image.entryId !== "string" ||
    !image.entryId ||
    image.entryId.length > 128
  )
    throw new Error("Invalid image reference.");
  if (
    image.attachmentId === "device-photo" &&
    (typeof image.imagePath !== "string" ||
      image.imagePath.length > 512 ||
      !/^[a-zA-Z0-9_./-]+$/.test(image.imagePath) ||
      image.imagePath
        .split("/")
        .some((part) => !part || part === "." || part === ".."))
  )
    throw new Error("Invalid image reference.");
  return {
    attachmentId: image.attachmentId,
    entryId: image.entryId,
    ...(image.attachmentId === "device-photo"
      ? { imagePath: image.imagePath }
      : {}),
  };
}
export async function boundedImage(response, remaining) {
  const mime = response.headers
    .get("content-type")
    ?.split(";")[0]
    .toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
    throw new VisionError(
      "Nova can read JPEG, PNG, and WebP photos. Resend this image in one of those formats.",
    );
  const maximum = Math.min(4 * 1024 * 1024, remaining);
  if (Number(response.headers.get("content-length")) > maximum) {
    await response.body?.cancel();
    throw new VisionError(
      "Image analysis supports photos up to 4 MB and 8 MB total. Resend a smaller photo.",
      413,
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new VisionError("The photo could not be read.");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new VisionError(
        "Image is too large to analyze. Resend a smaller photo.",
        413,
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const png =
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10;
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (
    !size ||
    !(mime === "image/png" ? png : mime === "image/jpeg" ? jpeg : webp)
  )
    throw new VisionError(
      "The photo format could not be read. Try another image.",
    );
  let binary = "";
  for (let index = 0; index < size; index += 8192)
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return { url: `data:${mime};base64,${btoa(binary)}`, size };
}
// Only this server constructs provider image data. Client URLs are never fetched.
export async function resolveVisionImages(
  body,
  { fetcher = fetch, base, key, authorization, userId, signal } = {},
) {
  const images = new Map();
  const entries = body.history.filter((entry) => entry.image);
  if (!entries.length) return images;
  const device = entries.filter(
    (entry) => entry.image.attachmentId === "device-photo",
  );
  let conversation;
  const headers = { apikey: key, Authorization: authorization };
  if (device.length) {
    if (!base || !key || !authorization || !userId)
      throw new VisionError("Sign in to analyze a shared photo.", 401);
    const response = await fetcher(
      base +
        "/rest/v1/shiftline_conversations?select=id,owner_id,recipient_id,payload&id=eq." +
        encodeURIComponent(body.conversationId) +
        "&limit=1",
      { headers, signal, redirect: "manual" },
    );
    if (!response.ok)
      throw new VisionError("This conversation's images are unavailable.", 403);
    const rows = await response.json();
    conversation = rows[0];
    if (
      !conversation ||
      ![conversation.owner_id, conversation.recipient_id].includes(userId) ||
      conversation.payload?.resolvedAt
    )
      throw new VisionError(
        "You cannot analyze images from this conversation.",
        403,
      );
  }
  let remaining = 8 * 1024 * 1024;
  for (const entry of entries) {
    const image = entry.image;
    if (VISION_FIXTURES[image.attachmentId]) {
      images.set(image.entryId, VISION_FIXTURES[image.attachmentId]);
      continue;
    }
    const saved = conversation.payload?.chat?.find(
      (item) => item.id === image.entryId,
    );
    if (
      !saved ||
      saved.kind !== "image" ||
      saved.attachmentId !== "device-photo" ||
      saved.senderId !== userId ||
      saved.imagePath !== image.imagePath ||
      !saved.imagePath.startsWith(conversation.id + "/")
    )
      throw new VisionError(
        "That photo is not part of your conversation.",
        403,
      );
    const path = saved.imagePath.split("/").map(encodeURIComponent).join("/");
    const response = await fetcher(
      base + "/storage/v1/object/authenticated/shiftline-photos/" + path,
      { headers, signal, redirect: "manual" },
    );
    if (!response.ok)
      throw new VisionError(
        "Photo unavailable. Reattach it and try again.",
        403,
      );
    const loaded = await boundedImage(response, remaining);
    remaining -= loaded.size;
    images.set(image.entryId, loaded.url);
  }
  return images;
}
