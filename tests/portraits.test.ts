import { describe, expect, it } from "vitest";
import { portraitIndex } from "../src/domain/portrait-selection";
import { team } from "../src/data/fixtures";
describe("stock portrait assignment", () => {
  it("gives each fictional human a distinct portrait and preserves the AI identity", () => {
    const people = team.filter((member) => member.kind !== "ai");
    const indices = people.map(portraitIndex);
    expect(new Set(indices).size).toBe(people.length);
    expect(
      indices.every((index) => index !== undefined && index >= 0 && index < 9),
    ).toBe(true);
    expect(portraitIndex(team[0])).toBeUndefined();
  });
  it("keeps assignments stable for cloud IDs, reordered lists and additional accounts", () => {
    expect(portraitIndex({ id: "uuid", name: "Mira Vale" })).toBe(
      portraitIndex(team[1]),
    );
    const person = { id: "another-account", name: "Alex Morgan" };
    expect(portraitIndex(person)).toBe(
      portraitIndex({ ...person, name: "Updated Name" }),
    );
    expect(portraitIndex(person)).toBeGreaterThanOrEqual(0);
  });
  it("uses Carlos’s portfolio photo only for his account or named profile", () => {
    expect(
      portraitIndex({
        id: "owner",
        name: "Teammate",
        email: "cmartinez@qsgpr.com",
      }),
    ).toBe(9);
    expect(portraitIndex({ id: "profile", name: "Carlos Martínez" })).toBe(9);
    expect(
      portraitIndex({
        id: "other",
        name: "Carlos Rivera",
        email: "other@example.test",
      }),
    ).not.toBe(9);
    for (let i = 0; i < 100; i++)
      expect(portraitIndex({ id: String(i), name: "New teammate" })).not.toBe(
        9,
      );
  });
});
