import { openStore } from "./store.mjs";
import { createSources } from "./sources.mjs";
import { createApp } from "./app.mjs";
const store = openStore(process.env.DATABASE_PATH || "./data/guildwar.sqlite");
const sources = createSources(store, {
  guildURL: process.env.GUILD_SOURCE_URL,
  fallbackURL: process.env.GUILD_FALLBACK_URL,
  memberBase: process.env.MEMBER_SOURCE_BASE,
});
const app = createApp({
  store,
  sources,
  writeToken: process.env.WRITE_TOKEN || "",
});
const server = app.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "0.0.0.0",
  () => console.log(`Guild War server ready on port ${server.address().port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
