# line-rangers-guildwar

LINEレンジャーのギルドランキング、メンバー情報、ギルド戦攻撃チェックを共有する非公式サイトです。React + Node.js + SQLite で動作します。LINEおよびゲーム運営会社とは関係ありません。

## 起動

Node.js 24以降を使用します。

```sh
npm ci
npm test
npm run build
npm start
```

`http://localhost:3000/guildWarCount` を開いてください。ランキングは `/guild-tracker` です。開発時は `npm run dev` を使います（画面変更後はブラウザーを再読み込み）。

## 実装した機能

- 実データのギルドランキング、国・地域とギルド名による絞り込み、上位100 / 500 / 全件表示。
- メンバー名、レベル、PVPランクの表示・並び替え。
- 味方・敵で別々のギルドを選択し、水・金・日の各2回の攻撃チェックを共有保存。
- 本日・今週の残り回数、今週の消化済み回数、当日の未攻撃・残りあり絞り込み。
- 日本時間09:00で日付を切り替え。月曜から日曜を1週として過去・翌週も表示。
- チェック変更をSQLiteへ即時保存。ほかの画面は15秒ごとに再取得。表示中は5分ごとにメンバー・一覧も再確認。
- 2回目をチェックすると1回目もチェック。1回目を解除すると2回目も解除。保存は明示的な真偽値なので再送で反転しません。
- ギルド・チーム・週を含む共有リンク、CSV出力、モバイル対応。
- 情報源の正常応答を永続キャッシュ。取得不能時は前回取得日時と警告を表示。

**攻撃結果をゲームから自動判定する機能ではありません。** ゲーム内で結果を確認した利用者が手動でチェックします。未チェックはこのサイトに未記録という意味です。

## データ取得元

| データ | 取得元 | キャッシュ |
| --- | --- | --- |
| ギルド一覧 | `https://rangers.lerico.net/api/v2/guilds` | 15分 |
| 一覧の予備取得先 | `https://rangers-api-3mfw.onrender.com/api/guilds/get-guild-names` | 同上 |
| メンバー | `https://rangers-api-3mfw.onrender.com/api/guild-member-info/{gid}/members` | 5分 |
| チェック状態 | このアプリケーションのSQLite | 毎回取得 |

取得先は**第三者の公開API**です。公式LINE APIとして扱っていません。公式のギルド／メンバー向け公開APIは今回確認できていません。第三者サービスの継続提供・最新性は保証できません。取得先は環境変数で変更できます。取得はサーバー側から行い、ブラウザーのCORS設定に依存しません。元サイトへの書き込み処理はありません。

調査内容と確認できた範囲は [docs/SOURCES.md](docs/SOURCES.md) に記録しています。コードはこのリポジトリ用に新規実装しており、参考サイトのソースを複製していません。

## 環境変数

`.env.example` を参照してください。Node.jsは `.env` を自動読込しません。`.env` を使う場合は `node --env-file=.env server/index.mjs` を実行します。

- `PORT`（初期値3000）、`HOST`（初期値0.0.0.0）
- `DATABASE_PATH`（初期値`./data/guildwar.sqlite`）
- `GUILD_SOURCE_URL`、`GUILD_FALLBACK_URL`、`MEMBER_SOURCE_BASE`
- `WRITE_TOKEN`：任意。設定すると保存にキーが必要です。画面の「使い方・保存設定」で入力します。キーはブラウザーのセッション内だけに保存されます。空の場合は元サイトと同様、共有編集です。

## 公開・永続化

### Render

`render.yaml` がBlueprint定義です。GitHubにこのコードを配置後、Renderの「New → Blueprint」でリポジトリを接続します。`/var/data` の永続ディスクにチェックとキャッシュを保存します。ディスク付きのStarterプランは有料です。**このコードの作成時点ではRenderへの作成・課金は実行していません。**

SQLite版は1インスタンスで実行してください。複数インスタンスを使う場合は共通のPostgreSQLなどへ保存層を変更します。単なる静的ホスティングやGitHub Pagesだけでは共有保存APIを実行できません。

### Docker

```sh
docker build -t line-rangers-guildwar .
docker run --rm -p 3000:3000 -v guildwar-data:/app/data line-rangers-guildwar
```

ボリューム・ディスクを省略すると、コンテナやホストの交換時に記録が失われます。バックアップは実行中のSQLiteファイルだけを単独コピーせず、SQLiteのバックアップ機能か停止時のDBを使用してください。

## 検証

```sh
npm test
npm run build
# npm start が別ターミナルで実行中の場合
npm run check:live
```

自動テストはJST09:00と週境界、年越し、ギルド・チーム・週の分離、保存後のDB再オープン、再送の冪等性、2回目と1回目の整合性、認証・送信元・入力検証、CSV数式対策を確認します。

## GitHubへの配置

対象は `line-rangers-fan/line-rangers-guildwar` です。現在のGitHub接続では、新規リポジトリ作成がGraphQL・REST両方で `Resource not accessible by integration`（403）となりました。そのためローカルGitリポジトリとして作成しています。

GitHub上に空の同名リポジトリを作成して接続対象に含めた後、次を実行します。

```sh
git remote add origin https://github.com/line-rangers-fan/line-rangers-guildwar.git
git push -u origin main
```

共有データ、キャッシュ、環境変数、node_modules、生成物はGitの管理対象外です。
