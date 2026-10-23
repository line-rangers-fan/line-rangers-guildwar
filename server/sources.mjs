import { EnvHttpProxyAgent, fetch } from "undici";
import { createSources as createCoreSources } from "../shared/sources.mjs";
export { normalizeGuilds, normalizeMembers } from "../shared/sources.mjs";
const agent = new EnvHttpProxyAgent();
async function getJSON(url) {
  const response = await fetch(url, {
    dispatcher: agent,
    signal: AbortSignal.timeout(25000),
    headers: {
      accept: "application/json",
      "user-agent": "line-rangers-guildwar/1.0 (read-only fan tool)",
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`情報源がHTTP ${response.status}を返しました`);
  }
  const text = await response.text();
  if (text.length > 10_000_000) throw new Error("情報源の応答が大きすぎます");
  return JSON.parse(text);
}

export function createSources(store, config = {}, requestJSON = getJSON) {
  return createCoreSources(store, config, requestJSON);
}
