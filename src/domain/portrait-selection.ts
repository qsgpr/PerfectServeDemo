import type { TeamMember } from "./types";
const names = [
  "mira",
  "ellis",
  "noa",
  "theo",
  "ada",
  "remy",
  "cedar",
  "willow",
  "carlos",
];
/** Stable presentation placeholders; these are not verified identity photos. */
export function portraitIndex(
  member: Pick<TeamMember, "id" | "kind" | "name"> & { email?: string },
): number | undefined {
  if (member.kind === "ai" || member.id === "nova") return undefined;
  const fullName = member.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (
    member.email?.trim().toLowerCase() === "cmartinez@qsgpr.com" ||
    fullName === "carlos martinez"
  )
    return 9;
  const name = member.name.trim().toLowerCase().split(/\s+/)[0];
  const known = names.indexOf(name);
  if (known >= 0) return known;
  let hash = 0;
  for (const char of member.id)
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return hash % names.length;
}
