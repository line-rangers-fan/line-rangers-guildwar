export const PUBLIC_ORIGIN = "https://line-rangers-fan.github.io";
export function trustedOrigin(origin, ownOrigin) {
  try { return new URL(origin).origin === ownOrigin || origin === PUBLIC_ORIGIN; }
  catch { return false; }
}
export function corsHeaders(origin) {
  return origin === PUBLIC_ORIGIN ? {
    "Access-Control-Allow-Origin": PUBLIC_ORIGIN,
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  } : {};
}
