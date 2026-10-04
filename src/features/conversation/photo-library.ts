import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { File } from "expo-file-system";
import { supabase } from "../../data/supabase";
export async function pickChatPhoto(messageId: string): Promise<string | null> {
  if (!supabase)
    throw new Error(
      "Photo sharing requires signing in to the shared workspace.",
    );
  const selection = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 0.8,
  });
  if (selection.canceled) return null;
  const asset = selection.assets[0];
  if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 8 MB.");
  const mime = asset.mimeType ?? "image/jpeg";
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/avif",
    ].includes(mime)
  )
    throw new Error("Choose a JPEG, PNG, WebP, HEIC, or AVIF image.");
  const bytes =
    Platform.OS === "web"
      ? await (await fetch(asset.uri)).arrayBuffer()
      : await new File(asset.uri).arrayBuffer();
  if (bytes.byteLength > 8 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 8 MB.");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sign in again to share a photo.");
  const ext = mime.split("/")[1].replace("jpeg", "jpg");
  const path =
    messageId +
    "/" +
    user.id +
    "/" +
    Date.now() +
    "-" +
    Math.random().toString(36).slice(2) +
    "." +
    ext;
  const uploaded = await supabase.storage
    .from("shiftline-photos")
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (uploaded.error) throw new Error(uploaded.error.message);
  return path;
}
