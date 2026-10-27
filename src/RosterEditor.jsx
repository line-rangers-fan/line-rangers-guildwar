import React, { useState } from "react";
import { LEAGUES } from "../shared/domain.mjs";
export function RosterEditor({ gid, members, token, onSaved, onClose, saveRoster }) {
  const [draft, setDraft] = useState(() => members.map((m) => ({ ...m }))),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [paste, setPaste] = useState("");
  const update = (uid, key, value) =>
    setDraft((rows) =>
      rows.map((m) => (m.uid === uid ? { ...m, [key]: value } : m)),
    );
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 1, gid, members: draft }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `roster-${gid}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(e) {
    try {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 100000) throw new Error("ファイルが大きすぎます");
      const value = JSON.parse(await f.text());
      if (value.gid && value.gid !== gid)
        throw new Error("別ギルドの名簿です。対象ギルドを開いてください");
      const list = Array.isArray(value) ? value : value.members;
      if (!Array.isArray(list) || list.length > 50)
        throw new Error("50人以内の名簿JSONを指定してください");
      setDraft(
        list.map((m) => ({
          uid: m.uid || crypto.randomUUID(),
          userName: typeof m.userName === "string" ? m.userName : "",
          level: m.level ?? 1,
          pvpLeaguePhase:
            typeof m.pvpLeaguePhase === "string" ? m.pvpLeaguePhase : "",
        })),
      );
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      e.target.value = "";
    }
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const data = await saveRoster(draft);
      onSaved(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  function addNames() {
    const names = paste
      .split(/\r?\n/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (draft.length + names.length > 50) {
      setError("メンバーは50人以内にしてください");
      return;
    }
    setDraft((rows) => [
      ...rows,
      ...names.map((userName) => ({
        uid: crypto.randomUUID(),
        userName,
        level: 1,
        pvpLeaguePhase: "",
      })),
    ]);
    setPaste("");
    setError("");
  }
  return (
    <section className="panel roster-editor">
      <div className="editor-heading">
        <h2>
          名簿を管理 <small>{draft.length} / 50人</small>
        </h2>
        <button className="text-button" onClick={onClose} disabled={saving}>
          閉じる
        </button>
      </div>
      <p>
        名前・レベル・PVPランクを登録します。改名は既存の行を編集すると攻撃記録を引き継げます。削除した行の攻撃記録はDBに保持します。
      </p>
      <div className="editor-list">
        {draft.map((m, i) => (
          <div className="editor-row" key={m.uid}>
            <span>{i + 1}</span>
            <label>
              メンバー名
              <input
                aria-label={`メンバー名 ${i + 1}`}
                value={m.userName}
                maxLength={100}
                onChange={(e) => update(m.uid, "userName", e.target.value)}
                disabled={saving}
              />
            </label>
            <label>
              レベル
              <input
                aria-label={`レベル ${i + 1}`}
                type="number"
                min="1"
                max="10000"
                value={m.level}
                onChange={(e) =>
                  update(
                    m.uid,
                    "level",
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                disabled={saving}
              />
            </label>
            <label>
              PVP
              <select
                aria-label={`PVP ${i + 1}`}
                value={m.pvpLeaguePhase}
                onChange={(e) =>
                  update(m.uid, "pvpLeaguePhase", e.target.value)
                }
                disabled={saving}
              >
                <option value="">未登録</option>
                {[
                  ...new Set([
                    ...LEAGUES,
                    ...(m.pvpLeaguePhase ? [m.pvpLeaguePhase] : []),
                  ]),
                ].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <button
              className="text-button"
              aria-label={`メンバーを削除 ${i + 1}`}
              disabled={saving}
              onClick={() =>
                setDraft((rows) => rows.filter((r) => r.uid !== m.uid))
              }
            >
              削除
            </button>
          </div>
        ))}
      </div>
      <div className="editor-paste">
        <label>
          メンバー名を1行に1人ずつ貼り付け
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"プレイヤーA\nプレイヤーB"}
            disabled={saving}
          />
        </label>
        <button
          className="button secondary"
          onClick={addNames}
          disabled={saving || !paste.trim()}
        >
          名簿に追加
        </button>
      </div>
      <div className="editor-actions">
        <button
          className="button secondary"
          disabled={saving || draft.length >= 50}
          onClick={() =>
            setDraft((rows) => [
              ...rows,
              {
                uid: crypto.randomUUID(),
                userName: "",
                level: 1,
                pvpLeaguePhase: "",
              },
            ])
          }
        >
          1人追加
        </button>
        <button
          className="button secondary"
          onClick={download}
          disabled={saving}
        >
          名簿JSONを保存
        </button>
        <label className="button secondary import-button">
          JSONを取り込み
          <input
            type="file"
            accept=".json,application/json"
            onChange={importFile}
            disabled={saving}
          />
        </label>
        <button className="button primary" onClick={save} disabled={saving}>
          {saving ? "保存中…" : "名簿を確定して保存"}
        </button>
      </div>
      {error && (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
      <p className="subtle">
        保存すると手動管理に切り替わり、公開データでは自動上書きされません。改名は既存の行を編集すると攻撃記録を引き継げます。名簿JSONは他の端末への持ち運びに使えます。
      </p>
    </section>
  );
}
export function GuildRegistration({ guilds, registeredGuilds, loading, error, onRegister, onClose }) {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState("100");
  const [selected, setSelected] = useState("");
  const choices = React.useMemo(() => guilds.filter((g) => g.lastGuildWarRank >= (limit === "100" ? 1 : 101) && g.lastGuildWarRank <= Number(limit) && g.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [guilds, limit, search]);
  const chosen = choices.find((g) => g.gid === selected);
  const already = registeredGuilds.some((g) => g.gid === selected);
  return (
    <form className="panel roster-editor personal-registration" onSubmit={(e) => { e.preventDefault(); if (chosen) onRegister(chosen); }}>
      <div className="editor-heading"><h2>自分のギルドを登録</h2><button type="button" className="text-button" onClick={onClose}>閉じる</button></div>
      <p>上位200ギルドから選択できます。登録はこのブラウザーだけに保存され、他の人の登録リストには反映されません。</p>
      <div className="personal-picker-filters">
        <label>ギルド名で検索<input value={search} onChange={(e) => { setSearch(e.target.value); setSelected(""); }} placeholder="ギルド名を入力" /></label>
        <label>順位の範囲<select value={limit} onChange={(e) => { setLimit(e.target.value); setSelected(""); }}><option value="100">1〜100位</option><option value="200">101〜200位</option></select></label>
      </div>
      <label>登録するギルド <small>{choices.length}件</small><select aria-label="登録するギルド" value={chosen ? selected : ""} onChange={(e) => setSelected(e.target.value)} disabled={loading} required><option value="">{loading ? "一覧を読み込み中…" : "ギルドを選んでください"}</option>{choices.map((g) => <option key={g.gid} value={g.gid}>#{g.lastGuildWarRank} {g.name}{registeredGuilds.some((r) => r.gid === g.gid) ? "（登録済み）" : ""}</option>)}</select></label>
      {!loading && !choices.length && <p role="status">{error || "条件に一致するギルドがありません。検索条件を変えてください。"}</p>}
      <p className="personal-note">公開名簿がない場合は、登録後に「名簿を管理」からメンバーを入力できます。</p>
      <button className="button primary" type="submit" disabled={!chosen || loading}>{already ? "このギルドを表示" : "自分のリストに登録"}</button>
    </form>
  );
}
