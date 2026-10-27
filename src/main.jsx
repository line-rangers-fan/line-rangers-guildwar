import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  checked,
  remaining,
  weekDates,
  gameDate,
  levelLabel,
  leagueLabel,
  LEAGUES,
} from "../shared/domain.mjs";
import "./style.css";
import "./compact.css";
import { apiURL, pagePath, publicBoardURL, transferToPublicSite, transferMessage } from "./runtime.mjs";
import { loadPrivateBoard, savePrivateBoard, checkedEntries } from "../shared/boards.mjs";
import { groupMembers } from "../shared/checklist.mjs";
import { resultAt, setResult, resultSummary } from "../shared/results.mjs";
import { readSharedResults, writeSharedResult, copySharedResults } from "./results-api.mjs";
import { loadRosterWithFallback } from "./public-roster.mjs";
import { loadGuildDirectory } from "./public-directory.mjs";
import { AttackControl } from "./AttackControl.jsx";
import { PREFERENCES_KEY, loadPersonal, initialChoice, resetPersonal } from "../shared/personal.mjs";
import { RosterEditor, GuildRegistration } from "./RosterEditor.jsx";
import { withReferencePvp, displayedPvpRank } from "../shared/pvp.mjs";
import { cachedPvp, loadPvpSnapshot, pvpSnapshotIsStale } from "./pvp-snapshot.mjs";

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
  const r = await fetch(apiURL(path), options);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "通信に失敗しました");
  return d;
}
async function boardApi(path, options = {}) {
  const r = await fetch(`https://line-rangers-guildwar-share-api.n-yu1791.chatgpt.site${path}`, options);
  const d = await r.json();
  if (!r.ok) throw Object.assign(new Error(d.error || "共有記録に接続できません"), { status:r.status });
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
const pvpRankText = (rank) => rank.replace("LEGEND", "レジェンド").replace("MASTER", "マスター").replace("DIAMOND", "ダイヤモンド").replace("GOLD", "ゴールド").replace("SILVER", "シルバー").replace("BRONZE", "ブロンズ").replace("_", " ");
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
let resetWarning = "";
if (query.get("reset") === "personal") {
  try { resetPersonal(localStorage); }
  catch { resetWarning = "このブラウザーの保存データを初期化できませんでした。ブラウザーのサイトデータ設定を確認してください。"; }
  for (const key of ["reset", "gid", "enemyGid", "share", "day"]) query.delete(key);
  history.replaceState(null, "", location.pathname + (query.size ? `?${query}` : ""));
}
function readPersonal() {
  try { return loadPersonal(localStorage); } catch { return loadPersonal({ getItem: () => null }); }
}
function loadChoice() {
  return initialChoice(query);
}
function activeGameDay(date) {
  const dates = weekDates(date);
  return [...dates].reverse().find((day) => day <= date) || dates[0];
}
function initialGameDay(savedDay) {
  const date = gameDate();
  const dates = weekDates(date);
  const requestedDay = query.get("day") || savedDay;
  const activeDay = activeGameDay(date);
  return dates.includes(requestedDay) && requestedDay >= activeDay ? requestedDay : activeDay;
}
function App() {
  const [view, setView] = useState(
    location.pathname.replace(/\/$/, "").endsWith("/guild-tracker") ? "ranking" : "checker",
  );
  const [guildResponse, setGuildResponse] = useState(null),
    [guildError, setGuildError] = useState(""),
    [guildLoading, setGuildLoading] = useState(true);
  const initialPersonal = useMemo(readPersonal, []);
  const [registeredGuilds, setRegisteredGuilds] = useState(initialPersonal.guilds);
  const [storageWarning, setStorageWarning] = useState(resetWarning);
  const [selection, setSelection] = useState(loadChoice);
  const team = "ally";
  const [sharing, setSharing] = useState(query.get("share") === "1");
  const [boardKey, setBoardKey] = useState(() => new URLSearchParams(location.hash.slice(1)).get("board") || "");
  const [shareFallback, setShareFallback] = useState("");
  const [country, setCountry] = useState(""),
    [tier, setTier] = useState(""),
    [tierResponse, setTierResponse] = useState(null),
    [search, setSearch] = useState(""),
    [rankLimit, setRankLimit] = useState("200");
  const [today, setToday] = useState(gameDate()),
    [filterDay, setFilterDay] = useState(() => initialGameDay(initialPersonal.filterDay)),
    [roster, setRoster] = useState(null),
    [states, setStates] = useState({}),
    [results, setResults] = useState(null),
    [resultsWarning, setResultsWarning] = useState(""),
    [rosterLoading, setRosterLoading] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState(""),
    [filter, setFilter] = useState(initialPersonal.filter),
    [sort, setSort] = useState(() => initialPersonal.sort.key === "pvp" ? { key: "pvp", dir: -1 } : { key: "level", dir: -1 }),
    [page, setPage] = useState(1),
    [rankSort, setRankSort] = useState({ key: "lastGuildWarRank", dir: 1 });
  const [rankEditor, setRankEditor] = useState(null);
  const [attackEditor, setAttackEditor] = useState(null);
  const [rankError, setRankError] = useState("");
  const [pvpReference, setPvpReference] = useState({ gid: "", members: [] }),
    [pvpLoading, setPvpLoading] = useState(false),
    [pvpWarning, setPvpWarning] = useState("");
  const rankDialog = useRef(null);
  const attackDialog = useRef(null);
  useEffect(() => { if (rankEditor) rankDialog.current?.showModal(); }, [rankEditor?.uid]);
  useEffect(() => { if (attackEditor) attackDialog.current?.showModal(); }, [attackEditor]);
  const [editingRoster, setEditingRoster] = useState(false),
    [registerGuild, setRegisterGuild] = useState(false);
  const [token] = useState(
      () => { try { return sessionStorage.getItem("guildwar-write-token") || ""; } catch { return ""; } },
    );
  const [refresh, setRefresh] = useState(0),
    [notice, setNotice] = useState(transferMessage);
  const generation = useRef(0),
    revision = useRef(0),
    busy = useRef(false),
    dateRef = useRef(today),
    noticeTimer = useRef(),
    migrationDone = useRef(false),
    personalSelection = useRef(initialPersonal.selection);
  const directoryUnavailable = Boolean(guildError || guildResponse?.stale);
  const gid = (guildResponse?.guilds.some((g) => g.gid === selection[team]) ||
    directoryUnavailable && registeredGuilds.some((g) => g.gid === selection[team] && g.lastGuildWarRank > 0 && g.lastGuildWarRank <= 200)) ? selection[team] : "";
  useEffect(() => {
    const c = new AbortController();
    if (view !== "ranking") return () => c.abort();
    api("/api/guild-tiers", { signal: c.signal }).then(setTierResponse).catch((e) => {
      if (e.name !== "AbortError") setTierResponse({ tiers: [], stale: true, warning: "階級情報を取得できません。すべての階級から検索できます。" });
    });
    return () => c.abort();
  }, [refresh, view]);
  const week = weekDates(today)[0];
  const dates = useMemo(() => weekDates(week), [week]);
  const currentDay = dates.includes(filterDay) ? filterDay : [...dates].reverse().find((d) => d <= today) || dates[0];
  useEffect(() => {
    const updateGameDate = () => {
      const nextDate = gameDate();
      if (dateRef.current === nextDate) return;
      dateRef.current = nextDate;
      setToday(nextDate);
      setFilterDay(activeGameDay(nextDate));
    };
    const t = setInterval(updateGameDate, 30000);
    window.addEventListener("focus", updateGameDate);
    document.addEventListener("visibilitychange", updateGameDate);
    const refreshData = setInterval(() => {
      if (!document.hidden && !busy.current && !editingRoster && !rankEditor && !attackEditor) setRefresh((n) => n + 1);
    }, 300000);
    return () => {
      clearInterval(t);
      clearInterval(refreshData);
      window.removeEventListener("focus", updateGameDate);
      document.removeEventListener("visibilitychange", updateGameDate);
    };
  }, [editingRoster, rankEditor, attackEditor]);
  useEffect(() => {
    const c = new AbortController();
    setGuildLoading(true);
    setGuildError("");
    loadGuildDirectory({ api, signal: c.signal, catalogURL: new URL('data/rosters.json', publicBoardURL()) })
      .then((r) => {
        setGuildResponse(r);
        // Directory availability and ranking changes must not delete personal registrations.
        // Migrate previous choices only when they match a real ranked guild ID.
        if (!migrationDone.current) {
          migrationDone.current = true;
          setRegisteredGuilds((saved) => {
          const combined = new Map(saved.map((g) => [g.gid, g]));
          for (const id of Object.values(initialPersonal.selection)) {
            const g = r.guilds.find((g) => g.gid === id);
            if (g && !combined.has(id)) combined.set(id, g);
          }
          return [...combined.values()];
          });
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") setGuildError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setGuildLoading(false);
      });
    return () => c.abort();
  }, [refresh]);
  useEffect(() => {
    try {
      if (!sharing) personalSelection.current = selection;
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ guilds: registeredGuilds, selection: personalSelection.current, team, sort, filterDay, filter }));
      setStorageWarning(resetWarning);
    } catch { setStorageWarning("このブラウザーでは登録情報を保存できません。再訪時の維持には、ストレージを許可した通常のブラウザーをご利用ください。"); }
    const q = new URLSearchParams();
    if (sharing) { q.set("share", "1"); q.set("day", currentDay); if (selection.ally) q.set("gid", selection.ally); }
    history.replaceState(
      null,
      "",
      `${pagePath(view)}${q.size ? `?${q}` : ""}${sharing && boardKey ? `#board=${encodeURIComponent(boardKey)}` : ""}`,
    );
  }, [selection, team, view, registeredGuilds, sort, filterDay, filter, sharing, currentDay, boardKey]);
  useEffect(() => {
    const seq = ++generation.current;
    const c = new AbortController();
    setStates({});
    setResults(null); setResultsWarning("");
    setError("");
    setRoster(null);
    setEditingRoster(false);
    setRankEditor(null);
    setAttackEditor(null);
    if (!gid) { setRosterLoading(false); return () => c.abort(); }
    setRosterLoading(true);
    async function readChecks() {
      if (sharing && boardKey) {
        if (!/^[0-9a-f]{64}$/.test(boardKey)) throw new Error("共有リンクが正しくありません。");
        const result = await boardApi(`/api/boards?week=${week}`, {signal:c.signal,headers:{"x-board-key":boardKey}});
        if (result.gid !== gid) throw new Error("共有リンクのギルドが一致しません。");
        return result;
      }
      if (sharing) return api(`/api/guilds/${gid}/checks?team=${team}&week=${week}`, { signal: c.signal });
      const saved = loadPrivateBoard(localStorage, gid, week);
      if (saved.exists) return { states: saved.states };
      const states = {};
      if (!c.signal.aborted) savePrivateBoard(localStorage, gid, week, states);
      return { states };
    }
    const readResults = async () => {
      try {
        const value = sharing
          ? await readSharedResults({api:boardApi, gid, boardKey, week, signal:c.signal})
          : loadPrivateBoard(localStorage, gid, week).results;
        if (seq === generation.current && !c.signal.aborted) setResultsWarning("");
        return value;
      } catch (e) {
        if (e.name === "AbortError") throw e;
        if (seq === generation.current) setResultsWarning("勝敗データを読み込めません。更新すると再取得します。");
        return null;
      }
    };
    const readRoster = () => loadRosterWithFallback({
      api, gid, signal:c.signal, token,
      catalogURL:new URL(`data/rosters/${gid}.json`, publicBoardURL()),
    });
    Promise.all([
      readRoster(),
      readChecks(),
      readResults(),
    ])
      .then(([r, s, outcomes]) => {
        if (seq === generation.current) { setRoster(r); setStates(s.states); setResults(outcomes); if (s.migrated) announce("以前のチェックを自分用に引き継ぎました。"); }
      })
      .catch((e) => {
        if (e.name !== "AbortError" && seq === generation.current) setError(e.message);
      })
      .finally(() => {
        if (seq === generation.current && !c.signal.aborted) setRosterLoading(false);
      });
    const poll = setInterval(() => {
      if (!sharing || busy.current || document.hidden) return;
      const rev = revision.current;
      Promise.all([readChecks(), readResults()])
        .then(([s, outcomes]) => {
          if (
            seq === generation.current &&
            rev === revision.current &&
            !busy.current
          )
            { setStates(s.states); setResults(outcomes); }
        })
        .catch(() => {});
    }, 15000);
    return () => {
      c.abort();
      clearInterval(poll);
    };
  }, [gid, team, week, refresh, sharing, boardKey]);
  useEffect(() => {
    setPvpWarning("");
    if (view !== "checker" || !gid || gid.startsWith("local-")) {
      setPvpLoading(false);
      return;
    }
    const controller = new AbortController();
    let storage;
    try { storage = localStorage; } catch { storage = { getItem: () => null, setItem: () => {} }; }
    const cached = cachedPvp(storage, gid);
    setPvpReference(cached || { gid, members: [] });
    setPvpLoading(!cached);
    loadPvpSnapshot({ gid, storage, signal: controller.signal, url: new URL(`data/pvp/${encodeURIComponent(gid)}.json`, publicBoardURL()) })
      .then(({ snapshot, offline }) => {
        if (controller.signal.aborted) return;
        if (!snapshot) {
          setPvpWarning("保存済みのPvPランクはまだありません。毎週土曜日に一括更新します。");
        } else {
          setPvpReference(snapshot);
          if (offline || pvpSnapshotIsStale(snapshot.fetchedAt)) setPvpWarning("PvPランクは前回取得した保存データです。最新の土曜日の更新を確認できませんでした。");
        }
      })
      .catch((error) => { if (error.name !== "AbortError" && !controller.signal.aborted) setPvpWarning("PvPランクの保存データを読み込めませんでした。"); })
      .finally(() => { if (!controller.signal.aborted) setPvpLoading(false); });
    return () => controller.abort();
  }, [gid, view]);
  useEffect(() => {
    setPage(1);
  }, [country, search, rankLimit, rankSort, tier]);
  function announce(s) {
    setNotice(s);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3500);
  }
  async function save(uid, day, slot, value) {
    if (busy.current || !results) return;
    const seq = generation.current;
    revision.current++;
    busy.current = true;
    setSaving(true);
    setError("");
    const previousStates = states;
    const nextDay = { ...states[uid]?.[day], [slot]: value !== null };
    if (slot === 2 && value !== null) nextDay[1] = true;
    if (slot === 1 && value === null) nextDay[2] = false;
    const nextStates = { ...states, [uid]: { ...states[uid], [day]: nextDay } };
    let nextResults = setResult(results, uid, day, slot, value);
    if (slot === 1 && value === null) nextResults = setResult(nextResults, uid, day, 2, null);
    if (slot === 2 && value !== null && !checked(states, uid, day, 1)) nextResults = setResult(nextResults, uid, day, 1, null);
    setStates(nextStates); setResults(nextResults);
    try {
      if (!sharing) {
        savePrivateBoard(localStorage, gid, week, nextStates, nextResults);
        return;
      }
      const resultArgs = {api:boardApi, gid, boardKey, week, members:roster.members, uid, day};
      const persistedResults = [...nextResults];
      // Clear metadata for a newly implied or removed attack before updating checks.
      if ((slot === 1 && value === null) || (slot === 2 && value !== null && !checked(states, uid, day, 1))) {
        const other = slot === 1 ? 2 : 1;
        persistedResults[other - 1] = await writeSharedResult({...resultArgs, slot:other, value:null});
      }
      persistedResults[slot - 1] = await writeSharedResult({...resultArgs, slot, value});
      if (boardKey) {
        await boardApi('/api/boards/roster', {method:'PUT',headers:{'Content-Type':'application/json','x-board-key':boardKey},body:JSON.stringify({members:roster.members})});
      }
      const r = await (boardKey ? boardApi : api)(boardKey ? '/api/boards/check' : `/api/guilds/${gid}/checks`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(boardKey ? {"x-board-key":boardKey} : {}),
          ...(token && !boardKey ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ team, uid, day, slot, checked:value !== null }),
      });
      if (seq === generation.current) { setStates(r.states); setResults(persistedResults); }
    } catch (e) {
      if (seq === generation.current) {
        setStates(previousStates); setResults(null);
        setResultsWarning("保存の途中で通信が切れました。「更新」で実際の記録を確認してください。");
        setError(sharing ? e.message : "このブラウザーに保存できません。ストレージ容量や設定を確認してください。");
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function saveMemberRank(event) {
    event.preventDefault();
    if (!rankEditor || busy.current) return;
    const seq = generation.current;
    busy.current = true;
    setSaving(true);
    setRankError("");
    try {
      const latest = await api(`/api/guilds/${gid}/members?include_pvp=0`);
      if (seq !== generation.current) return;
      if (!latest.members.some((m) => m.uid === rankEditor.uid)) throw new Error("このメンバーは名簿から削除されています。");
      const updated = latest.members.map((m) => m.uid === rankEditor.uid ? { ...m, pvpLeaguePhase: rankEditor.rank } : m);
      const result = await api(`/api/guilds/${gid}/roster`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ members: updated }),
      });
      if (seq === generation.current) {
        setRoster(result);
        setRankEditor(null);
        announce("PvPランク帯を保存しました");
      }
    } catch (error) {
      if (seq === generation.current) setRankError(error.message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const tiersByGuild = useMemo(() => new Map((tierResponse?.tiers || []).map((g) => [g.gid, g])), [tierResponse]);
  const guilds = useMemo(() => (guildResponse?.guilds || []).map((g) => ({ ...g, guildWarTier: tiersByGuild.get(g.gid)?.tier })), [guildResponse, tiersByGuild]);
  const personalGuilds = useMemo(() => registeredGuilds.filter((saved) => guilds.some((g) => g.gid === saved.gid) || directoryUnavailable && saved.lastGuildWarRank > 0 && saved.lastGuildWarRank <= 200).map((saved) => guilds.find((g) => g.gid === saved.gid) || saved), [guilds, registeredGuilds, directoryUnavailable]);
  const guild = guilds.find((g) => g.gid === gid) || personalGuilds.find((g) => g.gid === gid);
  const members = useMemo(() => withReferencePvp(roster?.members || [], pvpReference.gid === gid ? pvpReference.members : []), [roster, pvpReference, gid]);
  const rosterUnavailable = !roster || (members.length === 0 && roster.needsSetup);
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
  const dayResults = resultSummary(states, results, members, currentDay);
  const memberGroups = useMemo(() => groupMembers(
    members.filter((m) => m.userName.toLowerCase().includes(memberSearch.toLowerCase())),
    states, currentDay, filter, sort,
  ), [members, memberSearch, states, currentDay, filter, sort]);
  const visibleMembers = memberGroups.flatMap((group) => group.members);
  const dayLabel = `${currentDay.slice(5).replace("-", "/")}（${["水", "金", "日"][dates.indexOf(currentDay)]}）`;
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
  function registerPersonal(g) {
    setSharing(false); setShareFallback("");
    setRegisteredGuilds((saved) => saved.some((r) => r.gid === g.gid) ? saved : [...saved, g]);
    setSelection((s) => ({ ...s, [team]: g.gid }));
    setRegisterGuild(false); setView("checker"); setMemberSearch(""); setFilter("all");
    announce("自分の登録リストに追加しました");
  }
  function removePersonal() {
    setRegisteredGuilds((saved) => saved.filter((g) => g.gid !== gid));
    setSelection((s) => ({ ally: s.ally === gid ? "" : s.ally, enemy: s.enemy === gid ? "" : s.enemy }));
  }
  function openGuild(g) {
    setSharing(false); setShareFallback("");
    setSelection((s) => ({ ...s, [team]: g.gid }));
    setView("checker");
    setMemberSearch("");
    setFilter("all");
  }
  async function share(createNew = false) {
    if (!gid || busy.current || ((!sharing || createNew) && !results)) return;
    const seq = generation.current;
    busy.current = true; setSaving(true); setError("");
    const url = publicBoardURL();
    url.searchParams.set("gid", gid); url.searchParams.set("share", "1"); url.searchParams.set("day", currentDay);
    try {
      if (!sharing || createNew) {
        const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), b=>b.toString(16).padStart(2,'0')).join('');
        const result = await boardApi('/api/boards', {method:'POST',headers:{'Content-Type':'application/json','x-board-key':key},body:JSON.stringify({gid,members:roster.members,week,entries:checkedEntries(states,roster.members,dates)})});
        await copySharedResults({api:boardApi, gid, boardKey:key, week, members:roster.members, dates, states, results});
        if (seq !== generation.current) return;
        setBoardKey(key); setSharing(true); setStates(result.states);
        url.hash = `board=${key}`;
      } else if (boardKey) {
        if (!/^[0-9a-f]{64}$/.test(boardKey)) throw new Error("共有リンクが正しくありません。");
        url.hash = `board=${boardKey}`;
      }
      setShareFallback(url.href);
      try { await navigator.clipboard.writeText(url.href); announce("共有リンクをコピーしました。LINEに貼り付けて共有できます。"); }
      catch { announce("共有を開始しました。表示されたURLをコピーしてください。"); }
    } catch (e) { if (seq === generation.current) setError(e.message); }
    finally { busy.current = false; setSaving(false); }
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
        </select>
      </label>}
    </div>
  );
  return (
    <div className={`app ${view === "checker" ? "compact-checker" : ""}`}>
      <aside className="sidebar">
        <a className="brand" href={pagePath("checker")}>
          <span className="brand-mark">
            <Icon name="shield" size={26} />
          </span>
          <span>
            Guild War Note<small>LINE RANGERS</small>
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
      </aside>
      <div className="workspace">
        {attackEditor && <dialog ref={attackDialog} className="rank-dialog attack-dialog" aria-labelledby="attack-dialog-title" onCancel={() => setAttackEditor(null)} onClick={(event) => { if (event.target === event.currentTarget) setAttackEditor(null); }}>
          <h2 id="attack-dialog-title">{attackEditor.name}</h2>
          <p>{attackEditor.day.slice(5).replace("-", "/")}・{attackEditor.slot}回目の結果</p>
          <div className="attack-dialog-choices">
            {[ ["win", "○", "勝ち"], ["loss", "×", "負け"] ].map(([value, symbol, label]) => <button key={value} type="button" className={`attack-choice choice-${value}`} aria-pressed={resultAt(results, attackEditor.uid, attackEditor.day, attackEditor.slot) === value} onClick={() => {
              const { uid, day, slot } = attackEditor;
              const next = checked(states, uid, day, slot) && resultAt(results, uid, day, slot) === value ? null : value;
              setAttackEditor(null); setFilterDay(day); save(uid, day, slot, next);
            }}><strong aria-hidden="true">{symbol}</strong><span>{label}</span></button>)}
          </div>
          <p className="attack-dialog-hint">同じ結果をもう一度押すと記録を取り消せます。</p>
          <button type="button" className="text-button" onClick={() => setAttackEditor(null)}>閉じる</button>
        </dialog>}
        {rankEditor && <dialog ref={rankDialog} className="rank-dialog" onCancel={(e) => { if (saving) e.preventDefault(); else setRankEditor(null); }}>
          <form onSubmit={saveMemberRank}>
            <h2>{rankEditor.name}</h2>
            <label>PvPランク帯
              <select autoFocus value={rankEditor.rank} disabled={saving} onChange={(e) => setRankEditor((current) => ({ ...current, rank: e.target.value }))}>
                <option value="">未設定</option>
                {[...new Set([...LEAGUES, ...(rankEditor.rank ? [rankEditor.rank] : [])])].map((rank) => <option key={rank} value={rank}>{pvpRankText(rank)}</option>)}
              </select>
            </label>
            {rankError && <p role="alert">{rankError}</p>}
            <div className="rank-dialog-actions"><button type="button" className="button" disabled={saving} onClick={() => setRankEditor(null)}>キャンセル</button><button className="button" type="submit" disabled={saving}>{saving ? "保存中…" : "保存"}</button></div>
          </form>
        </dialog>}

        <header className="topbar">
          <span>
            ギルド管理 <span className="slash">/</span>{" "}
            <strong>
              {view === "checker" ? "攻撃チェック" : "ギルドランキング"}
            </strong>
          </span>
          <div className="topbar-right">
            <span className="jst">JST · 毎週月曜 00:00 リセット</span>
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
          {view === "checker" && <header className="site-title">Guild War Note</header>}
          {location.hostname.endsWith(".chatgpt.site") && <div className="site-migration"><span>新しいURLへ登録・自分用の記録を移せます。</span><button className="button" onClick={() => { try { transferToPublicSite(); } catch (e) { announce(e.message); } }}>新しいサイトへ移動</button></div>}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "checker" ? "Guild War Note" : "GUILD RANKINGS"}
              </div>
              <h1>
                {view === "checker"
                  ? "Guild War Note"
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
              disabled={guildLoading || rosterLoading || saving || editingRoster || Boolean(rankEditor) || Boolean(attackEditor)}
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
          {storageWarning && <div className="alert warning" role="alert">{storageWarning}</div>}
          {registerGuild && <GuildRegistration guilds={guilds} registeredGuilds={registeredGuilds} loading={guildLoading} error={guildError} onClose={() => setRegisterGuild(false)} onRegister={registerPersonal} />}
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
              <section id="checker-options-panel" className="panel checker-options-panel">
                <div className="checker-actions">
                  <button className="button" onClick={() => setView("ranking")}>ランキング</button>
                  <button className="button" onClick={() => setRefresh((n) => n + 1)} disabled={guildLoading || rosterLoading || saving || editingRoster || Boolean(rankEditor) || Boolean(attackEditor)}>更新</button>
                  <button className="button" onClick={() => share(false)} disabled={!gid || saving || rosterLoading || (!sharing && !results)}>{sharing ? "この共有リンクをコピー" : "共有リンクを作成"}</button>
                  {sharing && <button className="button" onClick={() => share(true)} disabled={!gid || saving || rosterLoading || !results}>新しい共有リンクを作成</button>}
                  {members.length > 0 && <button className="button" disabled={saving || rosterLoading} onClick={() => setEditingRoster(true)}>名簿を管理</button>}
                  {sharing && <button className="button" onClick={() => { setSharing(false); setShareFallback(""); setSelection({ ...personalSelection.current }); }}>自分用へ戻る</button>}
                </div>
                <label className="personal-guild-field">自分の登録ギルド
                  <select aria-label="自分の登録ギルド" disabled={saving} value={personalGuilds.some((g) => g.gid === gid) ? gid : ""} onChange={(e) => { setSharing(false); setShareFallback(""); setSelection((s) => ({ ...s, [team]: e.target.value })); setMemberSearch(""); }}>
                    <option value="">ギルドを選択してください</option>
                    {personalGuilds.map((g) => <option key={g.gid} value={g.gid}>{g.name}</option>)}
                  </select>
                </label>
                {sharing && <p className="personal-note">{boardKey ? "このリンクを知っている人がチェックを編集できます。新しい共有リンクを作成すると、現在のチェックをコピーした別の表になります。" : "以前の共有リンクです。同じギルドの旧リンクとチェックが共有されます。新しい共有リンクを作成すると別の表になります。"}</p>}
                {shareFallback && <label className="share-url-field">LINEに貼り付ける共有URL<input aria-label="共有URL" readOnly value={shareFallback} onFocus={(e) => e.target.select()} /></label>}
                <div className="personal-list-actions">
                {personalGuilds.some((g) => g.gid === gid) && <button className="text-button" onClick={removePersonal}>選択中のギルドの登録を解除</button>}
                <button className="text-button register-in-selection" onClick={() => setRegisterGuild((v) => !v)}>＋ ギルドを登録</button>
                </div>
              </section>
              {gid && (
                <>
                  <div className="checklist-heading">
                    <h1>{guild?.name || "ギルド"} <small>{rosterLoading ? "取得中…" : rosterUnavailable ? "名簿未取得" : `${members.length}人`}</small></h1>
                    <span className="win-summary" aria-label="選択日の勝率">{results ? <>{dayResults.wins}勝 / {dayResults.attacks}攻撃 ＝ {dayResults.rate === null ? "—" : `${dayResults.rate.toFixed(1)}%`}{dayResults.unknown > 0 && <small>（未判定{dayResults.unknown}・暫定）</small>}</> : "勝敗を取得中"}</span>
                    <span className="checklist-summary">{!registeredGuilds.some((g) => g.gid === gid) && guild && <button className="text-button" onClick={() => registerPersonal(guild)}>自分に登録</button>}<span>{currentDay.slice(5).replace("-", "/")} 残り <b>{rosterLoading || rosterUnavailable ? "—" : dayRemaining}</b>回</span></span>
                  </div>
                  {resultsWarning && <div className="alert warning" role="status">{resultsWarning}</div>}
                  {pvpWarning && <div className="alert warning" role="status">{pvpWarning}</div>}
                  {pvpReference.gid === gid && pvpReference.fetchedAt && <p className="personal-note">PvPランク取得 {dateText(pvpReference.fetchedAt)} · 毎週土曜更新 · 照合 {members.filter((m) => displayedPvpRank(m)).length}/{members.length}人</p>}
                  {roster?.publicObservedAt && <p className="personal-note">公開名簿の更新日時：{dateText(roster.publicObservedAt)} JST{roster.publicIncomplete ? ` ／ 配信済み${members.length}人・公称${roster.reportedMemberCount}人` : ""}</p>}
                  {!rosterLoading && roster && members.length === 0 && <button className="button" onClick={() => setEditingRoster(true)}>メンバーを登録</button>}
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
                      <select aria-label="攻撃状況の表示順" value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="all">すべて</option>
                        <option value="attacked">攻撃済み</option>
                        <option value="none">未攻撃</option>
                      </select>
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
                                <span className="name-sort-heading">名前
                                  <select aria-label="名前の並び順" value={sort.key} onChange={(e) => setSort({ key: e.target.value, dir: -1 })}>
                                    <option value="level">レベル順</option>
                                    <option value="pvp">PvPランク順</option>
                                  </select>
                                </span>
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
                            {memberGroups.flatMap((group) => [
                              ...(group.key !== "all" ? [<tr className={`member-group-row group-${group.key}`} key={`section:${group.key}`}><th colSpan={7}>{group.label}<small>{group.members.length}人</small></th></tr>] : []),
                              ...group.members.map((m) => {
                              return (
                                <tr key={m.uid} className="member-row" data-member-id={m.uid}>
                                  <th scope="row" className="member-name">
                                    <span className="member-identity">
                                      <button type="button" className="member-rank-button" disabled={saving} title={m.userName} onClick={() => { setRankError(""); setRankEditor({ uid: m.uid, name: m.userName, rank: m.pvpLeaguePhase || "" }); }} aria-label={`${m.userName}のPvPランク帯を設定`}><span className="member-name-text">{m.userName}</span></button>
                                      <small className="sort-level">{levelLabel(m.level)}</small>
                                      <span className="member-pvp" aria-label={`PvPランク ${displayedPvpRank(m) ? pvpRankText(displayedPvpRank(m)) : pvpLoading ? "取得中" : "未取得"}`} title={displayedPvpRank(m) ? pvpRankText(displayedPvpRank(m)) : "PvPランク未取得"}>{displayedPvpRank(m) ? leagueLabel(displayedPvpRank(m)) : pvpLoading ? "…" : "—"}</span>
                                    </span>
                                  </th>
                                  {dates.flatMap((d) => [1, 2].map((slot) => (
                                    <td key={`${d}-${slot}`} className={d === currentDay ? "selected-day check-cell" : "check-cell"}>
                                      <AttackControl
                                        name={m.userName}
                                        day={d}
                                        slot={slot}
                                        attacked={checked(states, m.uid, d, slot)}
                                        result={resultAt(results, m.uid, d, slot)}
                                        disabled={saving || !results}
                                        onOpen={() => setAttackEditor({uid:m.uid, name:m.userName, day:d, slot})}
                                      />
                                    </td>
                                  )))}
                                </tr>
                              );
                            }),
                            ])}
                          </tbody>
                        </table>
                        {!visibleMembers.length && (
                          <div className="empty">
                            {members.length
                              ? "条件に一致するメンバーはいません。"
                              : rosterUnavailable ? "公開名簿を取得できていません。配信元の未掲載・更新停止の可能性があります。「更新」で再取得するか、「メンバーを登録」から名簿を登録してください。" : "メンバー情報がありません。"}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="table-footer"><span>曜日を選ぶと、その日の攻撃状況で並べ替えます。</span><span>{rosterUnavailable ? "名簿未取得" : `${visibleMembers.length} / ${members.length}人`}</span></div>
                  </section>
                </>
              )}
              {!gid && (
                <div className="panel empty">
                  <Icon name="shield" size={36} />
                  <h2>ギルドを選んで始めましょう</h2>
                  <p>
                    「＋ ギルドを登録」から上位200ギルドを選択できます。登録すると、次回も自分のリストから選べます。
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
          <details className="source-details">
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
              。メンバー名簿は <a href="https://rangerbook.warmycat.com" target="_blank" rel="noreferrer">Rangerbook</a> の公開配信から取得し、このサイトのDBに保存します。閉鎖予定の元サイトへの通信は行いません（PvPランクの補完だけは例外です）。いずれも第三者サービスで、LINE公式APIではありません。Rangerbook側の収集元は未確認です。
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
              。一覧は15分、公開名簿は30分キャッシュします。自動取得中の名簿は画面の再読込時に更新します。手動編集・予備名簿の取り込み後は保存済み名簿を優先します。変更は「名簿を管理」で行えます。PvPランクは元サイトのメンバー情報から、同名が1人だけの人に限って照合します。表示と並び順は取得元のランクを優先し、照合できない人は未取得にします。
            </p>
            <p>
              ゲーム情報が最新とは限りません。ギルド一覧の取得が停止しても、保存済み・手動登録のギルドと名簿で攻撃チェックを継続できます。
            </p>
          </details>
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
          <div className="contact-footer">
            <p>問い合わせはこちらまで</p>
            <a href="https://x.com/LINE288372" target="_blank" rel="noopener noreferrer">
              <strong>LINEレンジャーは神ゲー</strong>
              <span>@LINE288372 ↗</span>
            </a>
          </div>
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


