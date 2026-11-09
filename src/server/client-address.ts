// Who sent a request, read the same way by every per-address limit: the webhook's per-sender cap (webhook.ts) and
// the cap on new demo copies (demo-limit.ts). Moved here from webhook.ts so the two never parse headers differently.

const IP_TEXT = /^[0-9A-Fa-f:.]{2,45}$/;

// Who sent the request. On Render, public traffic comes through Cloudflare, which sets CF-Connecting-IP on every
// request to a web service and overwrites any value the caller sent; it appends to X-Forwarded-For instead, so that
// header's first entry is whatever the caller wrote (https://render.com/articles/host-pocketbase-on-render; Render's
// DDoS guide says to read the client IP from x-forwarded-for:
// https://render.com/articles/how-render-handles-ddos-attacks). So CF-Connecting-IP comes first and the first
// X-Forwarded-For entry is only a fallback (P3-S6: check on the deployed service that CF-Connecting-IP arrives).
// With neither header (a local run), every request shares one sender, "unknown".
export function senderOf(headers: Pick<Headers, "get">): string {
  const cloudflare = headers.get("cf-connecting-ip")?.trim();
  if (cloudflare && IP_TEXT.test(cloudflare)) return cloudflare;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded && IP_TEXT.test(forwarded) ? forwarded : "unknown";
}

// IPv4 text with an optional IPv4-mapped IPv6 prefix, and one IPv6 group.
const DOTTED_TAIL = /^(.*:)?(\d{1,3}(?:\.\d{1,3}){3})$/;
const HEXTET = /^[0-9a-f]{1,4}$/;

// The eight 16-bit groups of an IPv6 address, or null if the text isn't one. A dotted IPv4 tail counts as two groups.
function ipv6Groups(address: string): number[] | null {
  let text = address.toLowerCase();
  const dotted = DOTTED_TAIL.exec(text);
  if (dotted) {
    if (dotted[1] === undefined) return null; // plain IPv4
    const bytes = dotted[2].split(".").map(Number);
    if (bytes.some((byte) => byte > 255)) return null;
    text = `${dotted[1]}${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] === "" ? [] : halves[0].split(":");
  const tail = halves.length === 2 && halves[1] !== "" ? halves[1].split(":") : [];
  if (![...head, ...tail].every((group) => HEXTET.test(group))) return null;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  return [...head, ...Array<string>(missing).fill("0"), ...tail].map((group) => parseInt(group, 16));
}

// The key a sender is counted under (P3-S5). One IPv6 host is usually given a whole /64, so it could rotate through
// 2^64 addresses; every address in a /64 shares one key. An IPv4-mapped IPv6 address counts as its IPv4 address.
// IPv4 addresses, "unknown" and text that doesn't read as IPv6 are kept as they are.
export function senderKey(sender: string): string {
  if (!sender.includes(":")) return sender;
  const groups = ipv6Groups(sender);
  if (!groups) return sender.toLowerCase();
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  }
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":")}::/64`;
}
