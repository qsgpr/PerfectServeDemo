import { describe, expect, it, vi } from "vitest";
import {
  describeDevice,
  notifyWebsiteVisit,
} from "../src/features/notifications/website-visit";

const hostname = "shiftline.qsgpr.com";
const now = 2_000_000_000_000;
function setup(last: string | null = null) {
  const storage = { getItem: vi.fn(() => last), setItem: vi.fn() };
  const fetcher =
    vi.fn<(url: string, options?: RequestInit) => Promise<Response>>();
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ city: "San Juan", country_name: "Puerto Rico" }),
    ),
  );
  fetcher.mockResolvedValueOnce(new Response("ok"));
  return { hostname, now, userAgent: "iPhone Safari", storage, fetcher };
}
describe("website visitor alerts", () => {
  it("alerts the existing topic without account or URL details", async () => {
    const options = setup();
    expect(await notifyWebsiteVisit(options)).toBe(true);
    expect(options.fetcher).toHaveBeenLastCalledWith(
      "https://ntfy.qsgpr.com/cmportfolio",
      expect.objectContaining({
        method: "POST",
        body: "San Juan, Puerto Rico · iOS · Safari",
        headers: expect.objectContaining({ Title: "Shiftline visited" }),
      }),
    );
    expect(options.storage.setItem).toHaveBeenCalledWith(
      "shiftline.visit-notified.v1",
      String(now),
    );
  });
  it("does not alert for local previews", async () => {
    const options = setup();
    expect(
      await notifyWebsiteVisit({ ...options, hostname: "localhost" }),
    ).toBe(false);
    expect(options.fetcher).not.toHaveBeenCalled();
  });
  it("suppresses repeat visits for 24 hours", async () => {
    const options = setup(String(now - 1000));
    expect(await notifyWebsiteVisit(options)).toBe(false);
    expect(options.fetcher).not.toHaveBeenCalled();
  });
  it("allows a new alert after 24 hours", async () => {
    expect(await notifyWebsiteVisit(setup(String(now - 86_400_000)))).toBe(
      true,
    );
  });
  it("still alerts when geolocation fails", async () => {
    const options = setup();
    options.fetcher
      .mockReset()
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValueOnce(new Response("ok"));
    expect(await notifyWebsiteVisit(options)).toBe(true);
    expect(options.fetcher).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ body: "Location unavailable · iOS · Safari" }),
    );
  });
  it("tolerates denied browser storage", async () => {
    const options = setup();
    options.storage.getItem.mockImplementation(() => {
      throw new Error("denied");
    });
    options.storage.setItem.mockImplementation(() => {
      throw new Error("denied");
    });
    expect(await notifyWebsiteVisit(options)).toBe(true);
  });
  it("does not record failed deliveries", async () => {
    const options = setup();
    options.fetcher
      .mockReset()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 500 }));
    expect(await notifyWebsiteVisit(options)).toBe(false);
    expect(options.storage.setItem).not.toHaveBeenCalled();
  });
  it("recognizes Edge before Chrome", () => {
    expect(describeDevice("Windows Chrome Safari Edg/130")).toBe(
      "Windows · Edge",
    );
  });
});
