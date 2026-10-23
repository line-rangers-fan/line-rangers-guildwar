# 情報源調査 — 2026-10-23 UTC

## 最初の参考サイト

- 画面： https://line-ranger-guild-war.onrender.com/guildWarCount
- 配信JS： `/static/js/main.eed84178.js`
- 公開ソースマップ： `/static/js/main.eed84178.js.map`
- `GuildWarCount.js` がAxiosでギルド・メンバー・保存済みチェックを読み込み、チェック操作をPOSTしていることを確認。
- 元ページの説明にも、攻撃の自動判定ではなく利用者の確認・入力である旨が明記されている。
- 実装確認：React 18.2.0 / React Router / Axios / Bootstrap + 独自CSS。APIレスポンスの `X-Powered-By: Express` を確認。DB製品は公開情報から特定できなかった。

## Lerico

- 画面： https://rangers.lerico.net/ja/guild-tracker
- 配信JS： `/app.872197b0.js`
- `ctrlerGuildTracker` が `GET /api/v2/guilds` で一覧、`GET /api/v2/guilds/{gid}` で詳細を取得。
- 一覧APIから実際に5,000件を取得。`gid, name, nationalFlag, lastGuildWarRank, lastGuildWarScore, currentMemberCount, expRank, lastFetchedV` などを確認。
- ギルド詳細APIは、確認したギルドについて説明文・告知・守護神などを返すが、メンバー一覧を返していない。別のギルドではHTTP403となる場合も確認。
- 元サイトのギルド一覧と項目構成が一致するが、元サイトのサーバーがLericoを参照していると断定できるコードは確認できていない。

## メンバー

- 元サイトと同じ読み取りAPI `GET https://rangers-api-3mfw.onrender.com/api/guild-member-info/{gid}/members` を採用。
- 実際に50人の `uid, userName, level, pvpLeaguePhase` を取得した。
- そのAPIのさらに上流のゲーム通信、認証方法、収集コードは未確認。LINE公式APIであるとは表示しない。
- このアプリケーションは第三者の保存用APIを呼ばない。攻撃記録の取得・更新は自前のSQLiteで完結する。

## 提供機能の範囲

参考サイトの攻撃チェッカーに相当する機能と、Lericoのギルドランキングの主要表示を新規実装。PVP分析は同じ組織の既存 `line-rangers-pvp` へ、レンジャー図鑑はLericoへリンクする。ゲームへのログイン、内部APIの解析・認証回避、元サイトの管理機能・広告の複製は実装していない。
