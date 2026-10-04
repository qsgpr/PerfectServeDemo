import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { supabase } from "../../data/supabase";
import { SvgXml } from "react-native-svg";
import { AttachmentId } from "../../domain/types";
export const CHAT_IMAGES: {
  id: AttachmentId;
  title: string;
  subtitle: string;
  xml: string;
}[] = [
  {
    id: "handoff-board",
    title: "Evening handoff board",
    subtitle: "Team coordination · 3 items",
    xml: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380"><rect width="600" height="380" rx="24" fill="#E8F0EA"/><rect x="26" y="26" width="548" height="328" rx="18" fill="#FFFFFF"/><rect x="26" y="26" width="548" height="72" rx="18" fill="#176453"/><text x="54" y="70" font-family="sans-serif" font-size="24" font-weight="700" fill="#FFFFFF">EVENING HANDOFF</text><text x="54" y="134" font-family="sans-serif" font-size="16" fill="#596D73">THURSDAY · TEAM COORDINATION</text><g font-family="sans-serif" font-size="20" fill="#192F39"><text x="91" y="190">Coverage confirmed</text><text x="91" y="250">Team room prepared</text><text x="91" y="310">Huddle at 19:30</text></g><g fill="#8EDCC1"><circle cx="64" cy="184" r="13"/><circle cx="64" cy="244" r="13"/><circle cx="64" cy="304" r="13"/></g><g fill="none" stroke="#176453" stroke-width="3"><path d="M57 184l5 5 9-10"/><path d="M57 244l5 5 9-10"/><path d="M57 304l5 5 9-10"/></g></svg>',
  },
  {
    id: "team-map",
    title: "Team room map",
    subtitle: "North wing · Level 2",
    xml: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380"><rect width="600" height="380" rx="24" fill="#F6EFE5"/><text x="36" y="50" font-family="sans-serif" font-size="24" font-weight="700" fill="#192F39">NORTH WING · LEVEL 2</text><rect x="38" y="83" width="160" height="108" rx="12" fill="#FFFFFF"/><rect x="230" y="83" width="330" height="108" rx="12" fill="#176453"/><rect x="38" y="251" width="220" height="93" rx="12" fill="#FFFFFF"/><rect x="290" y="251" width="270" height="93" rx="12" fill="#FFFFFF"/><path d="M115 298V219H395V139" fill="none" stroke="#C09A57" stroke-width="9" stroke-linecap="round" stroke-dasharray="12 16"/><circle cx="395" cy="139" r="15" fill="#8EDCC1"/><g font-family="sans-serif" font-size="20" fill="#192F39"><text x="65" y="136">Reception</text><text x="68" y="316">Workroom</text><text x="337" y="302">Lounge</text></g><text x="265" y="123" font-family="sans-serif" font-size="22" fill="#FFFFFF">Team room</text></svg>',
  },
];
export function SharedImage({
  id,
  height = 180,
  path,
}: {
  id: AttachmentId;
  height?: number;
  path?: string;
}) {
  const [uri, setUri] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!path || !supabase) return;
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase!.storage
        .from("shiftline-photos")
        .createSignedUrl(path, 3600);
      if (active) {
        setUri(data?.signedUrl ?? "");
        setFailed(!!error);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 50 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [path]);
  if (id === "device-photo")
    return (
      <View style={{ height, width: "100%", justifyContent: "center" }}>
        {uri && !failed ? (
          <Image
            accessibilityLabel="Shared photo"
            source={{ uri }}
            resizeMode="contain"
            style={{ width: "100%", height }}
            onError={() => setFailed(true)}
          />
        ) : (
          <Text>
            {failed
              ? "Photo unavailable. Reopen the conversation to retry."
              : "Loading photo…"}
          </Text>
        )}
      </View>
    );
  const asset = CHAT_IMAGES.find((a) => a.id === id)!;
  return (
    <SvgXml
      xml={asset.xml}
      width="100%"
      height={height}
      accessibilityRole="image"
      accessibilityLabel={asset.title}
    />
  );
}
