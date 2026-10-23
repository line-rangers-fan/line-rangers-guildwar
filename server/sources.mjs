import { EnvHttpProxyAgent, fetch } from "undici";
import { createSources as createCoreSources } from "../shared/sources.mjs";
import { readCompactSnapshot } from "../shared/rangerbook.mjs";
export { normalizeGuilds, normalizeMembers } from "../shared/sources.mjs";
const agent = new EnvHttpProxyAgent();
async function getJSON(url, options = {}) {
  const response = await fetch(url, {
    dispatcher: agent,
    signal: AbortSignal.timeout(options.compactGuilds ? 90000 : 25000),
    headers: {
      accept: "application/json",
      "user-agent": "line-rangers-guildwar/1.0 (read-only fan tool)",
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`情報源がHTTP ${response.status}を返しました`);
  }
  if (options.compactGuilds) return readCompactSnapshot(response);
  const text = await response.text();
  if (text.length > 10_000_000) throw new Error("情報源の応答が大きすぎます");
  return JSON.parse(text);
}

export function createSources(store, config = {}, requestJSON = getJSON) {
  return createCoreSources(store, config, requestJSON);
}
