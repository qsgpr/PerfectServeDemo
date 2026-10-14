const HOSTS = new Set([
  "shiftline.qsgpr.com",
  "shiftline-team-demo.giving-sage-4330.chatgpt.site",
]);
const STORAGE_KEY = "shiftline.visit-notified.v1";
const COOLDOWN = 24 * 60 * 60 * 1000;

type VisitFetcher = (url: string, options?: RequestInit) => Promise<Response>;

type VisitOptions = {
  hostname: string;
  userAgent: string;
  storage: Pick<Storage, "getItem" | "setItem">;
  fetcher?: VisitFetcher;
  now?: number;
};

export function describeDevice(userAgent: string) {
  const browser = /Edg/.test(userAgent)
    ? "Edge"
    : /Firefox|FxiOS/.test(userAgent)
      ? "Firefox"
      : /Chrome|CriOS/.test(userAgent)
        ? "Chrome"
        : /Safari/.test(userAgent)
          ? "Safari"
          : "Browser";
  const os = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Unknown OS";
  return `${os} · ${browser}`;
}

async function timedFetch(
  fetcher: VisitFetcher,
  url: string,
  options?: RequestInit,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetcher(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// A coarse visit alert, independent of accounts and conversation contents.
export async function notifyWebsiteVisit({
  hostname,
  userAgent,
  storage,
  fetcher = fetch,
  now = Date.now(),
}: VisitOptions): Promise<boolean> {
  if (!HOSTS.has(hostname)) return false;
  try {
    const last = Number(storage.getItem(STORAGE_KEY));
    if (last > 0 && now - last < COOLDOWN) return false;
  } catch {
    /* Private browsing may deny local storage. */
  }
  let location = "Location unavailable";
  try {
    const response = await timedFetch(fetcher, "https://ipapi.co/json/");
    if (response.ok) {
      const geo = await response.json();
      if (
        typeof geo.city === "string" &&
        typeof geo.country_name === "string"
      ) {
        location = `${geo.city}, ${geo.country_name}`;
      }
    }
  } catch {
    /* Location lookup is optional; still send the visit alert. */
  }
  try {
    const response = await timedFetch(
      fetcher,
      "https://ntfy.qsgpr.com/cmportfolio",
      {
        method: "POST",
        headers: {
          Title: "Shiftline visited",
          Priority: "default",
          Tags: "eyes",
          Click: "https://shiftline.qsgpr.com",
        },
        body: `${location} · ${describeDevice(userAgent)}`,
      },
    );
    if (!response.ok) return false;
    try {
      storage.setItem(STORAGE_KEY, String(now));
    } catch {
      /* Optional storage. */
    }
    return true;
  } catch {
    return false;
  }
}
