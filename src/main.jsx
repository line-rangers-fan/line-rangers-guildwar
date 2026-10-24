import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  checked,
  remaining,
  weekDates,
  gameDate,
} from "../shared/domain.mjs";
import "./style.css";
import "./compact.css";
import { AttackControl } from "./AttackControl.jsx";
import { PREFERENCES_KEY, loadPersonal, validSort, memberComparator } from "../shared/personal.mjs";
import { RosterEditor, GuildRegistration } from "./RosterEditor.jsx";

function Icon({ name, size = 20, ...props }) {
  const paths = {
    shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    check: "m5 12 4 4L19 6",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    refresh:
      "M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 2M4 17l2 2a8 8 0 0 0 13-2",
    arrow: "m9 5 7 7-7 7",
    download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.9M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8M16 3a4 4 0 0 1 0 8",
    clock: "M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
    info: "M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    trophy:
      "M8 3h8v6a4 4 0 0 1-8 0zM8 5H3v2a5 5 0 0 0 5 5M16 5h5v2a5 5 0 0 1-5 5M12 13v6M7 21h10",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.shield} />
    </svg>
  );
}
async function api(path, options = {}) {
  const r = await fetch(path, options);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "通信に失敗しました");
  return d;
}
const number = (n) => new Intl.NumberFormat("ja").format(n || 0);
const dateText = (s) =>
  s
    ? new Date(s).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const flag = (c) =>
  /^[A-Z]{2}$/.test(c)
    ? String.fromCodePoint(...[...c].map((x) => 127397 + x.charCodeAt(0)))
    : "🌐";
const countries = {
  JP: "日本",
  TW: "台湾",
  TH: "タイ",
  KR: "韓国",
  HK: "香港",
  US: "アメリカ",
  ID: "インドネシア",
  MY: "マレーシア",
  SG: "シンガポール",
  CN: "中国",
  VN: "ベトナム",
};
const query = new URLSearchParams(location.search);
function readPersonal() {
  try { return loadPersonal(localStorage); } catch { return loadPersonal({ getItem: () => null }); }
}
function loadChoice() {
  const s = readPersonal().selection;
  return { ally: query.get("gid") || s.ally, enemy: query.get("enemyGid") || s.enemy };
}
function App() {
  const [view, setView] = useState(
    location.pathname === "/guild-tracker" ? "ranking" : "checker",
  );
  const [guildResponse, setGuildResponse] = useState(null),
    [guildError, setGuildError] = useState(""),
    [guildLoading, setGuildLoading] = useState(true);
  const initialPersonal = useMemo(readPersonal, []);
  const [registeredGuilds, setRegisteredGuilds] = useState(initialPersonal.guilds);
  const [storageWarning, setStorageWarning] = useState("");
  const [selection, setSelection] = useState(loadChoice),
    [team, setTeam] = useState(
      ["ally", "enemy"].includes(query.get("team")) ? query.get("team") : initialPersonal.team,
    );
  const [country, setCountry] = useState(""),
    [tier, setTier] = useState(""),
    [tierResponse, setTierResponse] = useState(null),
    [search, setSearch] = useState(""),
    [rankLimit, setRankLimit] = useState("500");
  const [today, setToday] = useState(gameDate()),
    [filterDay, setFilterDay] = useState(""),
    [checkerTools, setCheckerTools] = useState(false),
    [roster, setRoster] = useState(null),
    [states, setStates] = useState({}),
    [rosterLoading, setRosterLoading] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState("");
  const [memberSearch, setMemberSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState(initialPersonal.sort),
    [page, setPage] = useState(1),
    [rankSort, setRankSort] = useState({ key: "lastGuildWarRank", dir: 1 });
  const [editingRoster, setEditingRoster] = useState(false),
    [registerGuild, setRegisterGuild] = useState(false);
  const [settings, setSettings] = useState(false),
    [token, setToken] = useState(
      () => sessionStorage.getItem("guildwar-write-token") || "",
    );
  const [refresh, setRefresh] = useState(0),
    [notice, setNotice] = useState(""),
    [health, setHealth] = useState(null);
  const generation = useRef(0),
    revision = useRef(0),
    busy = useRef(false),
    noticeTimer = useRef(),
    migrationDone = useRef(false);
  const gid = selection[team];
  useEffect(() => {
    const c = new AbortController();
    api("/api/guild-tiers", { signal: c.signal }).then(setTierResponse).catch((e) => {
      if (e.name !== "AbortError") setTierResponse({ tiers: [], stale: true, warning: "階級情報を取得できません。すべての階級から検索できます。" });
    });
    return () => c.abort();
  }, [refresh]);
  const week = weekDates(today)[0];
  const dates = useMemo(() => weekDates(week), [week]);
  const currentDay = dates.includes(filterDay) ? filterDay : dates.find((d) => d >= today) || dates[2];
  useEffect(() => {
    const t = setInterval(() => setToday(gameDate()), 30000);
    const refreshData = setInterval(() => {
      if (!document.hidden && !busy.current) setRefresh((n) => n + 1);
    }, 300000);
    return () => {
      clearInterval(t);
      clearInterval(refreshData);
    };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    setGuildLoading(true);
    setGuildError("");
    api("/api/guilds?limit=500", { signal: c.signal })
      .then((r) => {
        setGuildResponse(r);
        // Migrate previous choices only when they match a real ranked guild ID.
        if (!migrationDone.current) {
          migrationDone.current = true;
          setRegisteredGuilds((saved) => {
          const combined = new Map(saved.map((g) => [g.gid, g]));
          for (const id of Object.values(initialPersonal.selection)) {
            const g = r.guilds.find((g) => g.gid === id);
            if (g && !combined.has(id)) combined.set(id, g);
          }
          return combined.size === saved.length ? saved : [...combined.values()];
          });
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") setGuildError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setGuildLoading(false);
      });
    api("/api/health", { signal: c.signal })
      .then(setHealth)
      .catch(() => {});
    return () => c.abort();
  }, [refresh]);
  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ guilds: registeredGuilds, selection, team, sort }));
      setStorageWarning("");
    } catch { setStorageWarning("このブラウザーでは登録情報を保存できません。再訪時の維持には、ストレージを許可した通常のブラウザーをご利用ください。"); }
    const q = new URLSearchParams();
    if (selection.ally) q.set("gid", selection.ally);
    if (selection.enemy) q.set("enemyGid", selection.enemy);
    q.set("team", team);
    history.replaceState(
      null,
      "",
      `${view === "ranking" ? "/guild-tracker" : "/guildWarCount"}?${q}`,
    );
  }, [selection, team, view, registeredGuilds, sort]);
  useEffect(() => {
    const seq = ++generation.current;
    const c = new AbortController();
    setStates({});
    setError("");
    setSaved("");
    setRoster(null);
    setEditingRoster(false);
    if (!gid) { setRosterLoading(false); return () => c.abort(); }
    setRosterLoading(true);
    Promise.all([
      api(`/api/guilds/${gid}/members`, { signal: c.signal }),
      api(`/api/guilds/${gid}/checks?team=${team}&week=${week}`, {
        signal: c.signal,
      }),
    ])
      .then(([r, s]) => {
        if (seq === generation.current) {
          setRoster(r);
          setStates(s.states);
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError" && seq === generation.current)
          setError(e.message);
      })
      .finally(() => {
        if (seq === generation.current && !c.signal.aborted)
          setRosterLoading(false);
      });
    const poll = setInterval(() => {
      if (busy.current || document.hidden) return;
      const rev = revision.current;
      api(`/api/guilds/${gid}/checks?team=${team}&week=${week}`, {
        signal: c.signal,
      })
        .then((s) => {
          if (
            seq === generation.current &&
            rev === revision.current &&
            !busy.current
          )
            setStates(s.states);
        })
        .catch(() => {});
    }, 15000);
    return () => {
      c.abort();
      clearInterval(poll);
    };
  }, [gid, team, week, refresh]);
  useEffect(() => {
    setPage(1);
  }, [country, search, rankLimit, rankSort, tier]);
  function announce(s) {
    setNotice(s);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3500);
  }
  async function save(uid, day, slot, value) {
    if (busy.current) return;
    const seq = generation.current;
    revision.current++;
    busy.current = true;
    setSaving(true);
    setError("");
    setSaved("");
    const previousStates = states;
    const nextDay = { ...states[uid]?.[day], [slot]: value };
    if (slot === 2 && value) nextDay[1] = true;
    if (slot === 1 && !value) nextDay[2] = false;
    setStates({ ...states, [uid]: { ...states[uid], [day]: nextDay } });
    try {
      const r = await api(`/api/guilds/${gid}/checks`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ team, uid, day, slot, checked: value }),
      });
      if (seq === generation.current) {
        setStates(r.states);
        setSaved(
          new Date().toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        );
      }
    } catch (e) {
      if (seq === generation.current) {
        setStates(previousStates);
        setError(e.message);
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const tiersByGuild = useMemo(() => new Map((tierResponse?.tiers || []).map((g) => [g.gid, g])), [tierResponse]);
  const guilds = useMemo(() => (guildResponse?.guilds || []).map((g) => ({ ...g, guildWarTier: tiersByGuild.get(g.gid)?.tier })), [guildResponse, tiersByGuild]);
  const personalGuilds = useMemo(() => registeredGuilds.map((saved) => guilds.find((g) => g.gid === saved.gid) || saved), [guilds, registeredGuilds]);
  const guild = guilds.find((g) => g.gid === gid) || personalGuilds.find((g) => g.gid === gid);
  const members = roster?.members || [];
  const countryList = useMemo(
    () =>
      [...new Set(guilds.map((g) => g.nationalFlag).filter(Boolean))].sort(
        (a, b) => (a === "JP" ? -1 : b === "JP" ? 1 : a.localeCompare(b)),
      ),
    [guilds],
  );
  const listedGuilds = useMemo(
    () =>
      guilds
        .filter(
          (g) =>
            (!country || g.nationalFlag === country) &&
            (!tier || g.guildWarTier === tier) &&
            (!search || g.name.toLowerCase().includes(search.toLowerCase())) &&
            (tier ||
              (g.lastGuildWarRank > 0 &&
                g.lastGuildWarRank <= Number(rankLimit))),
        )
        .sort(
          (a, b) =>
            (a.lastGuildWarRank || 999999) - (b.lastGuildWarRank || 999999),
        ),
    [guilds, country, search, rankLimit, tier],
  );
  const dayRemaining = remaining(members, states, currentDay);
  const visibleMembers = useMemo(
    () =>
      members
        .filter(
          (m) =>
            m.userName.toLowerCase().includes(memberSearch.toLowerCase()) &&
            (filter === "all" ||
              (filter === "remaining" &&
                [1, 2].some((s) => !checked(states, m.uid, currentDay, s))) ||
              (filter === "none" &&
                [1, 2].every((s) => !checked(states, m.uid, currentDay, s)))),
        )
        .sort(memberComparator(sort)),
    [members, memberSearch, filter, states, currentDay, sort],
  );
  const rankedGuilds = useMemo(
    () =>
      [...listedGuilds].sort((a, b) => {
        const k = rankSort.key;
        return (
          rankSort.dir *
          ((a[k] ||
            (["lastGuildWarRank", "expRank", "eventStageRank"].includes(k)
              ? 999999
              : 0)) -
            (b[k] ||
              (["lastGuildWarRank", "expRank", "eventStageRank"].includes(k)
                ? 999999
                : 0)))
        );
      }),
    [listedGuilds, rankSort],
  );
  function sortBy(key) {
    setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
  }
  function registerPersonal(g) {
    setRegisteredGuilds((saved) => saved.some((r) => r.gid === g.gid) ? saved : [...saved, g]);
    setSelection((s) => ({ ...s, [team]: g.gid }));
    setRegisterGuild(false); setCheckerTools(false); setView("checker"); setMemberSearch(""); setFilter("all");
    announce("自分の登録リストに追加しました");
  }
  function removePersonal() {
    setRegisteredGuilds((saved) => saved.filter((g) => g.gid !== gid));
    setSelection((s) => ({ ally: s.ally === gid ? "" : s.ally, enemy: s.enemy === gid ? "" : s.enemy }));
  }
  function openGuild(g) {
    setSelection((s) => ({ ...s, [team]: g.gid }));
    setView("checker");
    setMemberSearch("");
    setFilter("all");
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      announce("このギルドのリンクをコピーしました");
    } catch {
      announce("ブラウザのアドレスをコピーして共有してください");
    }
  }
  const controls = (
    <div className={`controls${tier ? " tier-selected" : ""}`}>
      <label className="field search-field">
        <span>ギルドを探す</span>
        <div className="input-icon">
          <Icon name="search" size={17} />
          <input
            placeholder="ギルド名で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </label>
      <label className="field">
        <span>国・地域</span>
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">すべての国</option>
          {countryList.map((c) => (
            <option key={c} value={c}>
              {flag(c)} {countries[c] || c}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>ギルド戦の階級</span>
        <select value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="">すべての階級</option>
          <option value="LEGEND" disabled={!tierResponse?.tiers?.some((g) => g.tier === "LEGEND")}>レジェンド</option>
          <option value="MASTER" disabled={!tierResponse?.tiers?.some((g) => g.tier === "MASTER")}>マスター</option>
        </select>
      </label>
      {!tier && <label className="field">
        <span>ギルド戦順位</span>
        <select
          value={rankLimit}
          onChange={(e) => setRankLimit(e.target.value)}
        >
          <option value="100">上位100位</option>
          <option value="200">上位200位</option>
          <option value="500">上位500位</option>
        </select>
      </label>}
    </div>
  );
  return (
    <div className={`app ${view === "checker" ? "compact-checker" : ""}`}>
      <aside className="sidebar">
        <a className="brand" href="/guildWarCount">
          <span className="brand-mark">
            <Icon name="shield" size={26} />
          </span>
          <span>
            LINE RANGERS<small>GUILD WAR</small>
          </span>
        </a>
        <div className="nav-label">GUILD MANAGEMENT</div>
        <nav>
          <button
            className={view === "checker" ? "nav active" : "nav"}
            onClick={() => setView("checker")}
          >
            <Icon name="shield" />
            攻撃チェック
            <Icon name="arrow" size={15} />
          </button>
          <button
            className={view === "ranking" ? "nav active" : "nav"}
            onClick={() => setView("ranking")}
          >
            <Icon name="trophy" />
            ギルドランキング
          </button>
          <a
            className="nav"
            href="https://line-rangers-fan.github.io/line-rangers-pvp/"
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="grid" />
            PVP使用率<span className="external">↗</span>
          </a>
          <a
            className="nav"
            href="https://rangers.lerico.net/ja/rangers-book"
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="users" />
            レンジャー図鑑<span className="external">↗</span>
          </a>
        </nav>
        <div className="sidebar-note">
          <span className="live-dot" />
          チームの一手を、確実に。
          <p>
            攻撃の記録と残り回数を
            <br />
            ギルドのみんなで共有。
          </p>
          <span className="fan-label">UNOFFICIAL FAN TOOL</span>
        </div>
        <button className="settings" onClick={() => setSettings(!settings)}>
          <Icon name="info" size={17} />
          使い方・保存設定
        </button>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            ギルド管理 <span className="slash">/</span>{" "}
            <strong>
              {view === "checker" ? "攻撃チェック" : "ギルドランキング"}
            </strong>
          </span>
          <div className="topbar-right">
            <button
              className="mobile-settings"
              aria-label="使い方・保存設定"
              onClick={() => setSettings((v) => !v)}
            >
              <Icon name="info" size={16} />
            </button>
            <span className="jst">JST · 毎日 09:00 切り替え</span>
            <a
              href="https://github.com/line-rangers-fan"
              target="_blank"
              rel="noreferrer"
              className="avatar"
              aria-label="GitHub organization"
            >
              LR
            </a>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "checker" ? "GUILD WAR CHECKER" : "GUILD RANKINGS"}
              </div>
              <h1>
                {view === "checker"
                  ? "ギルド戦 攻撃チェック"
                  : "ギルドランキング"}
              </h1>
              <p>
                {view === "checker"
                  ? "攻撃状況を記録して、最後の一手まで使い切ろう。"
                  : "ギルドの順位と成績を比較し、メンバーを確認。"}
              </p>
            </div>
            <button
              className="button secondary refresh"
              onClick={() => setRefresh((n) => n + 1)}
              disabled={guildLoading || rosterLoading || saving}
            >
              <Icon name="refresh" size={17} />
              更新
            </button>
          </div>
          {view === "ranking" && (
            <div className="registration-toolbar">
              <button
                className="text-button"
                onClick={() => setRegisterGuild((v) => !v)}
              >
                ＋ ギルドを登録
              </button>
              <span>公開名簿の取得と、攻撃記録の共有</span>
            </div>
          )}
          {tierResponse?.stale && (view === "ranking" || checkerTools) && <div className="alert warning" role="status">{tierResponse.warning || "階級情報の更新が止まっています。保存済みの階級を表示しています。"}{tier && <button className="text-button" onClick={() => setTier("")}>すべて表示</button>}</div>}
          {storageWarning && <div className="alert warning" role="alert">{storageWarning}</div>}
          {registerGuild && <GuildRegistration guilds={guilds} registeredGuilds={registeredGuilds} loading={guildLoading} error={guildError} onClose={() => setRegisterGuild(false)} onRegister={registerPersonal} />}
          {settings && (
            <section className="help-panel">
              <h2>使い方と保存設定</h2>
              <p>
                対応ギルドはRangerbookの公開名簿から取得できます。名簿と攻撃記録はこのサイトのDBに保存します。攻撃結果はゲーム内で確認してください。各曜日の「1回目」「2回目」をチェックします。2回目をチェックすると1回目も記録され、1回目を外すと2回目も外れます。
              </p>
              <p>
                味方と敵で別々のギルドを選べます。チェックはこのサイトのサーバーに保存し、他の端末には約15秒で反映します。週は月曜〜日曜、日付は日本時間09:00に切り替わります。
              </p>
              {health?.writeProtected ? (
                <label>
                  保存用キー
                  <input
                    type="password"
                    value={token}
                    autoComplete="off"
                    onChange={(e) => {
                      setToken(e.target.value);
                      sessionStorage.setItem(
                        "guildwar-write-token",
                        e.target.value,
                      );
                    }}
                    placeholder="管理者から受け取ったキー"
                  />
                </label>
              ) : (
                <p>
                  現在は共有編集モードです。同じギルドを開いた利用者がチェックを編集できます。
                </p>
              )}
              <button
                className="text-button"
                onClick={() => setSettings(false)}
              >
                閉じる
              </button>
            </section>
          )}
          {guildError && (
            <div role="alert" className="alert">
              {guildError}
              <button onClick={() => setRefresh((n) => n + 1)}>再試行</button>
            </div>
          )}
          {(guildResponse?.stale || roster?.stale) && (
            <div className="alert warning">
              {guildResponse?.warning ||
                roster?.warning ||
                "情報源に接続できないため、保存済みデータを表示しています。取得日時を確認してください。"}
            </div>
          )}
          {view === "checker" ? (
            <>
              <div className="team-toolbar">
                <div className="segmented">
                  <button
                    className={team === "ally" ? "selected" : ""}
                    onClick={() => setTeam("ally")}
                    disabled={saving}
                  >
                    <span className="dot green" />
                    味方チーム
                  </button>
                  <button
                    className={team === "enemy" ? "selected" : ""}
                    onClick={() => setTeam("enemy")}
                    disabled={saving}
                  >
                    <span className="dot orange" />
                    敵チーム
                  </button>
                </div>
                <button className="checker-options" aria-expanded={checkerTools} aria-controls="checker-options-panel" onClick={() => setCheckerTools((v) => !v)}>設定</button>
              </div>
              {(checkerTools || !gid) && <section id="checker-options-panel" className="panel checker-options-panel">
                <div className="checker-actions">
                  <button className="button" onClick={() => setView("ranking")}>ランキング</button>
                  <button className="button" onClick={() => setRefresh((n) => n + 1)} disabled={guildLoading || rosterLoading || saving}>更新</button>
                  <button className="button" onClick={share}>共有リンク</button>
                  <button className="button" onClick={() => setSettings((v) => !v)}>使い方・保存設定</button>
                </div>
                <label className="personal-guild-field">自分の登録ギルド
                  <select aria-label="自分の登録ギルド" disabled={saving} value={personalGuilds.some((g) => g.gid === gid) ? gid : ""} onChange={(e) => { setSelection((s) => ({ ...s, [team]: e.target.value })); setMemberSearch(""); }}>
                    <option value="">ギルドを選択してください</option>
                    {personalGuilds.map((g) => <option key={g.gid} value={g.gid}>{g.name}</option>)}
                  </select>
                </label>
                <p className="personal-note">登録と並び順はこのブラウザーに保存。攻撃チェックはギルドで共有します。</p>
                {personalGuilds.some((g) => g.gid === gid) && <button className="text-button" onClick={removePersonal}>選択中のギルドの登録を解除</button>}
                <button className="text-button register-in-selection" onClick={() => setRegisterGuild((v) => !v)}>＋ ギルドを登録</button>
              </section>}
              {gid && (
                <>
                  <div className="checklist-heading">
                    <h1>{guild?.name || "ギルド"} <small>{members.length}人</small></h1>
                    <span>{!registeredGuilds.some((g) => g.gid === gid) && guild && <button className="text-button" onClick={() => registerPersonal(guild)}>自分に登録</button>}{currentDay.slice(5).replace("-", "/")} 残り <b>{rosterLoading ? "—" : dayRemaining}</b>回</span>
                  </div>
                  {(checkerTools || roster?.needsSetup) && <details
                    className="roster-details"
                    key={gid}
                    open={roster?.needsSetup || undefined}
                  >
                    <summary>
                      名簿の情報・管理
                      {roster?.warning && <span className="roster-warning">要確認</span>}
                    </summary>
                    <div className="roster-status">
                      <p>
                        {roster?.mode === "snapshot"
                          ? `閉鎖前に取得した保存名簿です（取得：${dateText(roster.fetchedAt)} JST）。入退会・改名は手動で反映してください。`
                          : roster?.mode === "manual"
                            ? "このサイトで管理している名簿です。ゲーム内での変更は「名簿を管理」から反映してください。"
                            : roster?.needsSetup
                              ? "公開名簿を取得できませんでした。「名簿を管理」から登録して利用できます。"
                              : roster?.mode === "rangerbook"
                                ? `Rangerbookの公開名簿（データ更新：${dateText(roster.fetchedAt)} JST）。表示名で照合します。改名・同名者は「名簿を管理」で確認してください。`
                              : roster?.mode === "provider"
                                ? "設定した独立した取得元から更新しています。"
                                : ""}
                      </p>
                      {roster?.warning && !roster?.stale && <p role="status">{roster.warning}</p>}
                      <button
                        className="button secondary"
                        disabled={rosterLoading || saving || editingRoster}
                        onClick={async () => {
                          const seq = generation.current;
                          setRosterLoading(true);
                          try {
                            const result = await api(`/api/guilds/${gid}/sync`, {
                              method: "POST",
                              headers: token ? { authorization: `Bearer ${token}` } : {},
                            });
                            if (seq !== generation.current) return;
                            setRoster(result);
                            announce(result.stale ? "取得できないため、保存名簿を維持しました" : "公開名簿を反映しました");
                          } catch (e) {
                            if (seq === generation.current) setError(e.message);
                          } finally {
                            if (seq === generation.current) setRosterLoading(false);
                          }
                        }}
                      >
                        {rosterLoading ? "取得中…" : "公開名簿を取得"}
                      </button>
                      <button
                        className="button secondary"
                        disabled={rosterLoading || saving}
                        onClick={() => setEditingRoster((v) => !v)}
                      >
                        名簿を管理
                      </button>
                    </div>
                  </details>}
                  {editingRoster && (
                    <RosterEditor
                      key={gid}
                      gid={gid}
                      members={members}
                      token={token}
                      onClose={() => setEditingRoster(false)}
                      onSaved={(r) => {
                        setRoster(r);
                        setGuildResponse((prev) =>
                          prev
                            ? {
                                ...prev,
                                guilds: prev.guilds.map((g) =>
                                  g.gid === gid
                                    ? {
                                        ...g,
                                        currentMemberCount: r.members.length,
                                      }
                                    : g,
                                ),
                              }
                            : prev,
                        );
                        setEditingRoster(false);
                        announce("名簿を保存しました");
                      }}
                    />
                  )}
                  <section className="panel roster-panel">
                    <div className="checklist-tools">
                      <input aria-label="メンバー検索" placeholder="名前で検索" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
                      <select className="checklist-sort" aria-label="メンバーの並び順" value={`${sort.key}:${sort.dir}`} onChange={(e) => { const [key, dir] = e.target.value.split(":"); setSort(validSort({ key, dir: Number(dir) })); }}>
                        <option value="name:1">名前 ↑</option><option value="name:-1">名前 ↓</option><option value="level:-1">レベル ↓</option><option value="level:1">レベル ↑</option>
                      </select>
                      <select aria-label="攻撃状況で絞り込み" value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="all">すべて</option>
                        <option value="remaining">残りあり</option>
                        <option value="none">未攻撃</option>
                      </select>
                    </div>
                    <div className="checklist-caption">
                      <span>チェック＝攻撃済み</span>
                      <span className="save-indicator" role="status">{saving ? "保存中…" : error ? "未保存" : saved ? "保存済み" : "自動保存"}</span>
                    </div>
                    {error && (
                      <div className="alert" role="alert">
                        {error}
                        <button onClick={() => setRefresh((n) => n + 1)}>
                          再試行
                        </button>
                      </div>
                    )}
                    {rosterLoading ? (
                      <div className="loading" role="status">
                        <span className="spinner" />
                        メンバーと攻撃記録を取得しています…
                      </div>
                    ) : !roster ? (
                      <div className="empty">
                        メンバーを取得できませんでした。更新ボタンから再試行してください。
                      </div>
                    ) : (
                      <div className="table-scroll">
                        <table className="member-table compact-member-table">
                          <colgroup>
                            <col className="member-column" />
                            {dates.flatMap((d) => [1, 2].map((slot) => <col key={`${d}-${slot}`} className="attack-column" />))}
                          </colgroup>
                          <thead>
                            <tr>
                              <th scope="col" rowSpan={2}>
                                <button onClick={() => sortBy("name")}>名前 ↕</button>
                              </th>
                              {dates.map((d, i) => (
                                <th scope="colgroup" colSpan={2} key={d} className={d === currentDay ? "selected-day day-heading" : "day-heading"}>
                                  <button className="day-filter" aria-pressed={d === currentDay} aria-label={`${d}の攻撃状況で絞り込み`} onClick={() => setFilterDay(d)}>
                                    {["水", "金", "日"][i]}<small>{d.slice(5).replace("-", "/")}{d === today ? " 本日" : ""}</small>
                                  </button>
                                </th>
                              ))}
                            </tr>
                            <tr>
                              {dates.flatMap((d) => [1, 2].map((slot) => <th scope="col" key={`${d}-${slot}`} className={d === currentDay ? "selected-day attack-slot-heading" : "attack-slot-heading"}>{slot}回目</th>))}
                            </tr>
                          </thead>
                          <tbody>
                            {visibleMembers.map((m) => {
                              return (
                                <tr key={m.uid}>
                                  <th scope="row" className="member-name">
                                    <strong>{m.userName}</strong>{sort.key === "level" && <small className="sort-level">Lv.{m.level}</small>}
                                  </th>
                                  {dates.flatMap((d) => [1, 2].map((slot) => (
                                    <td key={`${d}-${slot}`} className={d === currentDay ? "selected-day check-cell" : "check-cell"}>
                                      <AttackControl
                                        name={m.userName}
                                        day={d}
                                        slot={slot}
                                        value={checked(states, m.uid, d, slot)}
                                        disabled={saving}
                                        onChange={(value) => save(m.uid, d, slot, value)}
                                      />
                                    </td>
                                  )))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {!visibleMembers.length && (
                          <div className="empty">
                            {members.length
                              ? "条件に一致するメンバーはいません。"
                              : "メンバー情報がありません。"}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="table-footer"><span>日付を選ぶと、その日の未攻撃で絞り込めます。</span><span>{visibleMembers.length} / {members.length}人</span></div>
                  </section>
                </>
              )}
              {!gid && (
                <div className="panel empty">
                  <Icon name="shield" size={36} />
                  <h2>ギルドを選んで始めましょう</h2>
                  <p>
                    「＋ ギルドを登録」から上位500ギルドを選択できます。登録すると、次回も自分のリストから選べます。
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <section className="panel selection-panel">{controls}</section>
              <section className="panel ranking-panel">
                <div className="ranking-heading">
                  <h2>
                    ギルド一覧 <span>{number(listedGuilds.length)} GUILDS</span>
                  </h2>
                  <p>ギルド名を選ぶと攻撃チェックを開きます。</p>
                </div>
                {guildLoading ? (
                  <div className="loading">
                    <span className="spinner" />
                    ランキングを取得しています…
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table className="ranking-table">
                      <thead>
                        <tr>
                          <th>国</th>
                          <th>ギルド名</th>
                          <th>階級</th>
                          {[
                            ["lastGuildWarRank", "ギルド戦順位"],
                            ["lastGuildWarScore", "戦績"],
                            ["expRank", "経験値順位"],
                            ["level", "Lv."],
                            ["currentMemberCount", "人数"],
                          ].map(([key, label]) => (
                            <th key={key}>
                              <button
                                onClick={() =>
                                  setRankSort((s) => ({
                                    key,
                                    dir: s.key === key ? -s.dir : 1,
                                  }))
                                }
                              >
                                {label} ↕
                              </button>
                            </th>
                          ))}
                          <th>情報源の更新</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedGuilds
                          .slice((page - 1) * 25, page * 25)
                          .map((g) => (
                            <tr key={g.gid}>
                              <td>
                                {flag(g.nationalFlag)}{" "}
                                <span className="subtle">{g.nationalFlag}</span>
                              </td>
                              <td>
                                <button
                                  className="guild-link"
                                  onClick={() => openGuild(g)}
                                >
                                  {g.name}
                                  <Icon name="arrow" size={14} />
                                </button>
                              </td>
                              <td>{g.guildWarTier === "LEGEND" ? "レジェンド" : g.guildWarTier === "MASTER" ? "マスター" : "—"}</td>
                              <td>
                                <span
                                  className={
                                    g.lastGuildWarRank <= 3 &&
                                    g.lastGuildWarRank > 0
                                      ? "rank-medal"
                                      : ""
                                  }
                                >
                                  {g.lastGuildWarRank
                                    ? `#${number(g.lastGuildWarRank)}`
                                    : "—"}
                                </span>
                              </td>
                              <td>{number(g.lastGuildWarScore)}</td>
                              <td>
                                {g.expRank ? `#${number(g.expRank)}` : "—"}
                              </td>
                              <td>{g.level}</td>
                              <td>
                                {g.currentMemberCount}
                                <span className="subtle"> / 50</span>
                              </td>
                              <td className="subtle">
                                {dateText(g.lastFetchedV)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {!rankedGuilds.length && (
                      <div className="empty">
                        条件に一致するギルドがありません。
                      </div>
                    )}
                  </div>
                )}
                <div className="pagination">
                  <span>{number(listedGuilds.length)}件 · 1ページ25件</span>
                  <div>
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      前へ
                    </button>
                    <span>
                      {page} /{" "}
                      {Math.max(1, Math.ceil(listedGuilds.length / 25))}
                    </span>
                    <button
                      disabled={page * 25 >= listedGuilds.length}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      次へ
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
          {(view === "ranking" || checkerTools) && <details className="source-details">
            <summary>データ取得元・取得日時</summary>
            <p>
              ギルド一覧：
              <a
                href="https://rangers.lerico.net/ja/guild-tracker"
                target="_blank"
                rel="noreferrer"
              >
                LINE Rangers Handbook（Lerico）
              </a>
              。メンバー名簿は <a href="https://rangerbook.warmycat.com" target="_blank" rel="noreferrer">Rangerbook</a> の公開配信から取得し、このサイトのDBに保存します。閉鎖予定の元サイトへの通信は行いません。いずれも第三者サービスで、LINE公式APIではありません。Rangerbook側の収集元は未確認です。
            </p>
            <p>
              一覧取得：{dateText(guildResponse?.fetchedAt)} JST
              {roster && (
                <>
                  {" "}
                  ／ 名簿更新：{dateText(
                    roster.updatedAt || roster.fetchedAt,
                  )}{" "}
                  JST
                </>
              )}
              。一覧は15分、公開名簿は30分キャッシュします。公開名簿の利用開始後は画面の再読込時に更新します。手動編集後は手動名簿を優先し、「公開名簿を取得」で自動更新に戻せます。PVPランクは配信されないため更新しません。
            </p>
            <p>
              ゲーム情報が最新とは限りません。ギルド一覧の取得が停止しても、保存済み・手動登録のギルドと名簿で攻撃チェックを継続できます。
            </p>
          </details>}
          <footer>
            <span>
              LINE RANGERS <b>GUILD WAR</b>
              <small>
                非公式ファンプロジェクト。LINE・運営会社とは関係ありません。
              </small>
            </span>
            <a
              href="https://github.com/line-rangers-fan"
              target="_blank"
              rel="noreferrer"
            >
              line-rangers-fan ↗
            </a>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {notice}
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
