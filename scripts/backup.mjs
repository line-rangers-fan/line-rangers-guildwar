import { DatabaseSync, backup } from "node:sqlite";
import { resolve } from "node:path";
const source = resolve(process.env.DATABASE_PATH || "./data/guildwar.sqlite");
const target = process.argv[2];
if (!target || resolve(target) === source)
  throw new Error(
    "異なる保存先を指定してください: node scripts/backup.mjs /path/to/backup.sqlite",
  );
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, resolve(target));
  console.log("SQLiteバックアップを保存しました。");
} finally {
  db.close();
}
