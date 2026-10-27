import { loadPersonal, PREFERENCES_KEY } from "../shared/personal.mjs";
import { validId } from "../shared/domain.mjs";
const apiOrigin = typeof __API_ORIGIN__ === "string" ? __API_ORIGIN__ : "";
const basePath = typeof __BASE_PATH__ === "string" ? __BASE_PATH__ : "/";
export const PUBLIC_ROOT = "https://line-rangers-fan.github.io/line-rangers-guildwar/";
export const apiURL = (path) => `${apiOrigin}${path}`;
export const pagePath = (view) => `${basePath}${view === "ranking" ? "guild-tracker/" : ""}`;
export function publicBoardURL() {
  return new URL(["localhost", "127.0.0.1"].includes(location.hostname) ? basePath : PUBLIC_ROOT, location.origin);
}
const supportedKey = (key) => typeof key === "string" && (key === PREFERENCES_KEY || key === "guildwar-selection" || (key.startsWith("guildwar-private-checks:") && validId(key.slice("guildwar-private-checks:".length))) || (key.startsWith("guildwar-personal-roster:") && validId(key.slice("guildwar-personal-roster:".length))));
export function transferToPublicSite() {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (supportedKey(key)) entries.push([key, localStorage.getItem(key)]);
  }
  const fragment = encodeURIComponent(JSON.stringify({ version: 1, entries }));
  if (fragment.length > 180000) throw new Error("移行する記録が多いため、この画面での利用を続けてください。共有リンクは新しいURLで利用できます。");
  const url = new URL(PUBLIC_ROOT);
  url.search = location.search;
  url.hash = `import=${fragment}`;
  location.assign(url.href);
}
function importTransfer() {
  if (!location.hash.startsWith("#import=")) return "";
  try {
    if (location.hash.length > 180020) throw new Error("移行データが大きすぎます");
    const data = JSON.parse(decodeURIComponent(location.hash.slice(8)));
    if (data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 1002) throw new Error("移行データを確認してください");
    const incoming = new Map(data.entries.filter((e) => Array.isArray(e) && typeof e[0] === "string" && supportedKey(e[0]) && typeof e[1] === "string"));
    const before = loadPersonal(localStorage);
    const previous = loadPersonal({ getItem: (key) => incoming.get(key) || null });
    const guilds = new Map(previous.guilds.map((g) => [g.gid, g]));
    for (const g of before.guilds) guilds.set(g.gid, g);
    const chosen = localStorage.getItem(PREFERENCES_KEY) ? before : previous;
    for (const [key, value] of incoming) {
      JSON.parse(value);
      if (key !== PREFERENCES_KEY && localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...chosen, guilds: [...guilds.values()].slice(0, 500) }));
    return "登録と自分用の記録を引き継ぎました。";
  } catch { return "登録情報の移行を完了できませんでした。前のサイトには元の記録が残っています。"; }
  finally { history.replaceState(null, "", location.pathname + location.search); }
}
export const transferMessage = importTransfer();
