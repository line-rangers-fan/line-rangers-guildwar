import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const checks = sqliteTable(
  "checks",
  {
    gid: text("gid").notNull(),
    team: text("team").notNull(),
    uid: text("uid").notNull(),
    day: text("day").notNull(),
    slot: integer("slot").notNull(),
    checked: integer("checked").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gid, t.team, t.uid, t.day, t.slot] }),
    check("valid_slot", sql`${t.slot} in (1,2)`),
    check("valid_checked", sql`${t.checked} in (0,1)`),
  ],
);
export const cache = sqliteTable("cache", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
  source: text("source").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});
export const localGuilds = sqliteTable("local_guilds", {
  gid: text("gid").primaryKey(),
  payload: text("payload").notNull(),
});
export const rosters = sqliteTable("rosters", {
  gid: text("gid").primaryKey(),
  payload: text("payload").notNull(),
  mode: text("mode").notNull(),
  observedAt: text("observed_at"),
  updatedAt: text("updated_at").notNull(),
});

export const isolatedBoards = sqliteTable("isolated_boards", {
  id: text("id").primaryKey(),
  gid: text("gid").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
});
