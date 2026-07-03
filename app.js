"use strict";
/* ============ SOLO LEVELING SYSTEM — V3 PWA « MONARQUE » ============ */

const APP_VERSION = "3.2.0";
const KEY = "sls-data";

/* ===== constantes de jeu ===== */
const RANKS = [
  { min: 1, label: "E", color: "#9a8fb8" },
  { min: 5, label: "D", color: "#8f7fd8" },
  { min: 10, label: "C", color: "#a06bff" },
  { min: 18, label: "B", color: "#c49bff" },
  { min: 28, label: "A", color: "#e8b45a" },
  { min: 40, label: "S", color: "#ff5a7a" },
];
const QUEST_RANKS = { E: 20, D: 40, C: 70, B: 110, A: 160, S: 250 };
const ROUTINE_XP = { E: 10, D: 15, C: 20, B: 30, A: 40, S: 60 };
const DAYS = ["D", "L", "M", "M", "J", "V", "S"];
const STATS = {
  FOR: { label: "Force", hint: "sport, physique" },
  INT: { label: "Intelligence", hint: "études, travail" },
  VOL: { label: "Volonté", hint: "discipline, habitudes" },
  SOC: { label: "Social", hint: "équipe, relations" },
  SAN: { label: "Santé", hint: "sommeil, nutrition, soin" },
};

/* ===== helpers ===== */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const keyFor = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const todayKey = () => keyFor(new Date());
const rankFor = (l) => [...RANKS].reverse().find((r) => l >= r.min) || RANKS[0];
const xpNeeded = (l) => l * 100;
const streakMult = (s) => (s >= 30 ? 2 : s >= 7 ? 1.5 : s >= 3 ? 1.2 : 1);
const daysLeft = (dl) => (dl ? Math.ceil((new Date(dl + "T23:59:59") - new Date()) / 864e5) : null);

/* ===== état ===== */
const DEFAULT = {
  player: { xp: 0, level: 1, streak: 0, totalDone: 0, stats: { FOR: 0, INT: 0, VOL: 0, SOC: 0, SAN: 0 } },
  quests: [],
  routines: [],
  history: {},
  lastDay: todayKey(),
  priority: null,
};

let state = null;
let tab = "home";
let openQuest = null;
let editingQuest = null;
let editingRoutine = null;
let swReg = null;

function load() {
  let d = structuredClone(DEFAULT);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const loaded = JSON.parse(raw);
      d = mergeData(loaded);
    }
  } catch (e) {}
  return d;
}

function mergeData(loaded) {
  return {
    ...structuredClone(DEFAULT),
    ...loaded,
    player: {
      ...structuredClone(DEFAULT.player),
      ...(loaded.player || {}),
      stats: { ...structuredClone(DEFAULT.player.stats), ...((loaded.player || {}).stats || {}) },
    },
    quests: Array.isArray(loaded.quests) ? loaded.quests : [],
    routines: Array.isArray(loaded.routines) ? loaded.routines : [],
    history: loaded.history || {},
  };
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

/* ===== reset journalier + pénalité ===== */
function dailyReset(d) {
  const today = todayKey();
  if (d.lastDay === today) return d;
  const yesterday = d.lastDay;
  const yDate = new Date(yesterday + "T12:00:00");
  const due = d.routines.filter((r) => r.days.includes(yDate.getDay()));
  const missed = due.filter((r) => !((d.history[yesterday] || {}).done || []).includes(r.id));
  let penalty = 0;
  missed.forEach((r) => (penalty += Math.floor(ROUTINE_XP[r.rank] / 2)));
  if (due.length > 0) {
    if (missed.length === 0) d.player.streak += 1;
    else d.player.streak = 0;
  }
  d.player.xp = Math.max(0, d.player.xp - penalty);
  d.lastDay = today;
  d.priority = null;
  d._penalty = penalty > 0 ? { xp: penalty, count: missed.length } : null;
  return d;
}

function maybeRollover() {
  if (state && state.lastDay !== todayKey()) {
    state = dailyReset(state);
    save();
    render();
    if (state._penalty) showPenalty();
  }
}

/* ===== progression ===== */
function gainXP(base) {
  const amount = Math.round(base * streakMult(state.player.streak));
  state.player.xp += amount;
  const t = todayKey();
  state.history[t] = state.history[t] || { done: [] };
  state.history[t].xp = (state.history[t].xp || 0) + amount;
  let leveled = false;
  while (state.player.xp >= xpNeeded(state.player.level)) {
    state.player.xp -= xpNeeded(state.player.level);
    state.player.level += 1;
    leveled = true;
  }
  return { amount, leveled };
}

/* ===== actions ===== */
function toggleRoutine(id) {
  const r = state.routines.find((x) => x.id === id);
  if (!r) return;
  const today = todayKey();
  const day = (state.history[today] = state.history[today] || { done: [] });
  const idx = day.done.indexOf(id);
  const stat = r.stat || "VOL";
  if (idx >= 0) {
    day.done.splice(idx, 1);
    state.player.xp = Math.max(0, state.player.xp - ROUTINE_XP[r.rank]);
    state.player.stats[stat] = Math.max(0, state.player.stats[stat] - 1);
  } else {
    day.done.push(id);
    state.player.totalDone += 1;
    state.player.stats[stat] += 1;
    const res = gainXP(ROUTINE_XP[r.rank]);
    const dow = new Date().getDay();
    const due = state.routines.filter((x) => x.days.includes(dow));
    const allDone = due.length > 0 && due.every((x) => day.done.includes(x.id));
    if (allDone && !day.victory) {
      day.victory = true;
      gainXP(30);
      toast("⚔ JOURNÉE CONQUISE", "Toutes les quêtes du jour accomplies · +30 XP bonus");
    } else {
      toast(res.leveled ? "NIVEAU SUPÉRIEUR !" : "+" + res.amount + " XP", res.leveled ? "Niveau " + state.player.level : STATS[stat].label + " +1");
    }
  }
  save();
  render();
}

function toggleSub(qid, sid) {
  const quest = state.quests.find((x) => x.id === qid);
  if (!quest) return;
  const sub = quest.subs.find((x) => x.id === sid);
  if (!sub) return;
  sub.done = !sub.done;
  const stat = quest.stat || "INT";
  const isPriority = state.priority && state.priority.date === todayKey() && state.priority.questId === quest.id;
  let per = Math.max(5, Math.floor(QUEST_RANKS[quest.rank] / Math.max(1, quest.subs.length)));
  if (isPriority) per = Math.round(per * 1.5);
  if (sub.done) {
    state.player.totalDone += 1;
    state.player.stats[stat] += 1;
    const allDone = quest.subs.every((x) => x.done);
    const bonus = allDone ? QUEST_RANKS[quest.rank] : 0;
    const res = gainXP(per + bonus);
    if (allDone) toast("QUÊTE ACCOMPLIE", "« " + quest.title + " » terminée");
    else if (res.leveled) toast("NIVEAU SUPÉRIEUR !", "Niveau " + state.player.level);
    else toast("+" + res.amount + " XP" + (isPriority ? " ★" : ""), isPriority ? "Bonus cible du jour ×1.5" : quest.title);
  } else {
    state.player.xp = Math.max(0, state.player.xp - per);
    state.player.stats[stat] = Math.max(0, state.player.stats[stat] - 1);
  }
  save();
  render();
}

function setPriority(qid) {
  const t = todayKey();
  state.priority = state.priority && state.priority.questId === qid && state.priority.date === t ? null : { date: t, questId: qid };
  save();
  render();
}

function deleteQuest(qid) {
  state.quests = state.quests.filter((x) => x.id !== qid);
  save();
  render();
}

function deleteRoutine(id) {
  state.routines = state.routines.filter((x) => x.id !== id);
  save();
  render();
}

/* ===== dérivés ===== */
function activeQuests() {
  return state.quests.filter((q) => q.subs.length === 0 || !q.subs.every((s) => s.done));
}
function priorityQuest() {
  if (!state.priority || state.priority.date !== todayKey()) return null;
  return activeQuests().find((q) => q.id === state.priority.questId) || null;
}
function nextAction(q) {
  return q.subs.find((s) => !s.done) || null;
}

/* ===== toast ===== */
function toast(title, sub) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = '<div class="toast-title">' + esc(title) + "</div>" + (sub ? '<div class="toast-sub">' + esc(sub) + "</div>" : "");
  $("#toasts").innerHTML = "";
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ===== rendu ===== */
function render() {
  renderHeader();
  renderNav();
  const main = $("#main");
  if (tab === "home") main.innerHTML = homeHTML();
  else if (tab === "quests") main.innerHTML = questsHTML();
  else if (tab === "routines") main.innerHTML = routinesHTML();
  else main.innerHTML = profileHTML();
  $("#fab").className = "fab" + (tab === "profile" ? " hide" : "");
}

function renderHeader() {
  const p = state.player;
  const rank = rankFor(p.level);
  const prog = Math.min(100, Math.round((p.xp / xpNeeded(p.level)) * 100));
  const mult = streakMult(p.streak);
  $("#hdr").innerHTML =
    '<div class="hdr-inner">' +
    '<div class="rank-badge" style="border-color:' + rank.color + ";color:" + rank.color + '">' + rank.label + "</div>" +
    '<div class="hdr-right">' +
    '<div class="player-row"><span class="lvl">NIV. ' + p.level + '</span><span class="streak">🔥 ' + p.streak + (mult > 1 ? ' <span class="mult">×' + mult + "</span>" : "") + "</span></div>" +
    '<div class="xp-bar"><div class="xp-fill" style="width:' + prog + '%"></div></div>' +
    '<div class="xp-text">' + p.xp + " / " + xpNeeded(p.level) + " XP</div>" +
    "</div></div>";
}

function renderNav() {
  const tabs = [["home", "◆", "Aujourd'hui"], ["quests", "⚔", "Quêtes"], ["routines", "↻", "Routines"], ["profile", "☰", "Profil"]];
  $("#nav").innerHTML = tabs
    .map(([k, ic, lb]) =>
      '<button class="nav-btn' + (tab === k ? " active" : "") + '" data-act="tab" data-tab="' + k + '">' +
      '<span class="nav-ic">' + ic + '</span><span class="nav-lb">' + lb + "</span></button>"
    ).join("");
}

function sectionTitle(txt, spaced) {
  return '<h2 class="section-title' + (spaced ? " spaced" : "") + '"><span class="diamond">◇</span>' + txt + "</h2>";
}

function deadlineTag(q) {
  const dl = daysLeft(q.deadline);
  if (dl === null) return "";
  if (dl < 0) return '<span class="dl over">ÉCHOUÉE J+' + -dl + "</span>";
  if (dl <= 3) return '<span class="dl boss">☠ BOSS · J-' + dl + "</span>";
  return '<span class="dl">J-' + dl + "</span>";
}

function questCardHTML(q, opts) {
  opts = opts || {};
  const done = q.subs.filter((s) => s.done).length;
  const pct = q.subs.length ? Math.round((done / q.subs.length) * 100) : 0;
  const complete = q.subs.length > 0 && done === q.subs.length;
  const next = nextAction(q);
  const isP = opts.isPriority;
  let html = '<div class="card quest' + (complete ? " done" : "") + '">';
  html += '<div class="quest-head">';
  if (!complete) html += '<button class="star' + (isP ? " on" : "") + '" data-act="star" data-q="' + q.id + '">★</button>';
  html += '<button class="quest-main' + (complete ? " noStar" : "") + '" data-act="open-quest" data-q="' + q.id + '">';
  html += '<span class="quest-rank">' + q.rank + "</span>";
  html += '<div class="qm-body"><div class="card-title">' + esc(q.title) + "</div>";
  html += '<div class="card-sub">' + done + "/" + q.subs.length + " · " + STATS[q.stat || "INT"].label + " " + deadlineTag(q) + "</div>";
  if (opts.compact && next) html += '<div class="na-inline">▶ ' + esc(next.title) + "</div>";
  html += "</div>";
  html += '<span class="pct">' + pct + "%</span></button></div>";
  html += '<div class="q-bar"><div class="q-fill" style="width:' + pct + '%"></div></div>';
  if (opts.open && !opts.compact) {
    html += '<div class="subs">';
    q.subs.forEach((s) => {
      html += '<button class="sub' + (s.done ? " sdone" : "") + '" data-act="toggle-sub" data-q="' + q.id + '" data-s="' + s.id + '">' +
        '<div class="checkbox small' + (s.done ? " checked" : "") + '">' + (s.done ? "✓" : "") + "</div><span>" + esc(s.title) + "</span></button>";
    });
    html += '<div class="btn-row"><button class="del-quest" style="border-color:rgba(160,110,255,.45);color:#b99cf0" data-act="edit-quest" data-q="' + q.id + '">✎ Modifier</button>' +
      '<button class="del-quest" data-act="del-quest" data-q="' + q.id + '">Supprimer</button></div></div>';
  }
  html += "</div>";
  return html;
}

function priorityCardHTML(q) {
  const next = nextAction(q);
  const done = q.subs.filter((s) => s.done).length;
  const pct = q.subs.length ? Math.round((done / q.subs.length) * 100) : 0;
  let html = '<div class="card priority"><div class="prio-head"><span class="prio-star">★</span>';
  html += '<div style="flex:1"><div class="card-title">' + esc(q.title) + '</div><div class="card-sub">' + done + "/" + q.subs.length + " · XP ×1.5 " + deadlineTag(q) + "</div></div>";
  html += '<button class="del" data-act="star" data-q="' + q.id + '">✕</button></div>';
  if (next) {
    html += '<button class="next-action" data-act="toggle-sub" data-q="' + q.id + '" data-s="' + next.id + '">' +
      '<div class="checkbox small"></div><div><div class="na-label">PROCHAINE ACTION</div><div class="na-title">' + esc(next.title) + "</div></div></button>";
  } else {
    html += '<div class="na-done">Toutes les étapes sont accomplies ⚔</div>';
  }
  html += '<div class="q-bar"><div class="q-fill" style="width:' + pct + '%"></div></div></div>';
  return html;
}

function homeHTML() {
  const today = todayKey();
  const doneToday = (state.history[today] || {}).done || [];
  const dow = new Date().getDay();
  const due = state.routines.filter((r) => r.days.includes(dow));
  const pq = priorityQuest();
  const actives = activeQuests();

  let html = sectionTitle("CIBLE DU JOUR");
  if (pq) html += priorityCardHTML(pq);
  else html += '<div class="empty">Choisis <b>UNE</b> quête prioritaire (★ sur une quête ci-dessous).<br><span style="font-size:12px;opacity:.8">Une seule cible = XP ×1.5 sur ses étapes. Le focus bat la dispersion.</span></div>';

  html += sectionTitle("QUÊTES JOURNALIÈRES", true);
  if (due.length === 0) html += '<div class="empty">Aucune routine aujourd\'hui. Crée-les dans l\'onglet Routines.</div>';
  due.forEach((r) => {
    const done = doneToday.includes(r.id);
    html += '<button class="card row' + (done ? " done" : "") + '" data-act="toggle-routine" data-r="' + r.id + '">' +
      '<div class="checkbox' + (done ? " checked" : "") + '">' + (done ? "✓" : "") + "</div>" +
      '<div style="flex:1"><div class="card-title">' + esc(r.title) + '</div>' +
      '<div class="card-sub">' + (r.time ? "⏰ " + esc(r.time) + " · " : "") + STATS[r.stat || "VOL"].label + " · +" + ROUTINE_XP[r.rank] + " XP</div></div></button>";
  });
  if (due.length > 0) {
    const doneCount = doneToday.filter((id) => due.some((r) => r.id === id)).length;
    html += '<div class="day-progress">' + ((state.history[today] || {}).victory ? "⚔ JOURNÉE CONQUISE" : doneCount + " / " + due.length + " accomplies") + "</div>";
  }

  html += sectionTitle("OBJECTIFS EN COURS", true);
  if (actives.length === 0) html += '<div class="empty">Aucun objectif actif. Crée ta première quête.</div>';
  actives.forEach((q) => { html += questCardHTML(q, { compact: true, isPriority: pq && pq.id === q.id }); });
  return html;
}

function questsHTML() {
  const actives = activeQuests();
  const pq = priorityQuest();
  let html = sectionTitle("QUÊTES");
  if (actives.length >= 4) html += '<div class="warn-box">⚠ ' + actives.length + " quêtes actives — risque de dispersion. Termine avant d'en ouvrir d'autres.</div>";
  if (state.quests.length === 0) html += '<div class="empty">Aucune quête. Appuie sur + pour créer un objectif.</div>';
  state.quests.forEach((q) => { html += questCardHTML(q, { open: openQuest === q.id, isPriority: pq && pq.id === q.id }); });
  return html;
}

function routinesHTML() {
  let html = sectionTitle("ROUTINES");
  if (state.routines.length === 0) html += '<div class="empty">Aucune routine. Appuie sur + pour en créer une.</div>';
  state.routines.forEach((r) => {
    html += '<div class="card"><div class="flex-between"><div>' +
      '<div class="card-title">' + esc(r.title) + "</div>" +
      '<div class="card-sub">' + r.days.map((d) => DAYS[d]).join(" · ") + (r.time ? " · ⏰ " + esc(r.time) : "") + " · " + STATS[r.stat || "VOL"].label + " · rang " + r.rank + "</div>" +
      '</div><div style="display:flex;gap:2px"><button class="del" style="color:#b99cf0" data-act="edit-routine" data-r="' + r.id + '">✎</button><button class="del" data-act="del-routine" data-r="' + r.id + '">✕</button></div></div></div>';
  });
  return html;
}

function profileHTML() {
  const p = state.player;
  const rank = rankFor(p.level);
  let html = sectionTitle("STATUT DU JOUEUR");
  html += '<div class="card profile-card">' +
    '<div class="rank-big" style="color:' + rank.color + ";border-color:" + rank.color + '">' + rank.label + "</div>" +
    '<div class="p-title">' + (p.level >= 40 ? "MONARQUE DES OMBRES" : "CHASSEUR DE RANG " + rank.label) + "</div>" +
    '<div class="p-grid">' +
    '<div><span class="p-num">' + p.level + '</span><span class="p-lb">Niveau</span></div>' +
    '<div><span class="p-num">' + p.streak + '</span><span class="p-lb">Série 🔥</span></div>' +
    '<div><span class="p-num">' + p.totalDone + '</span><span class="p-lb">Actions</span></div>' +
    "</div></div>";

  const maxStat = Math.max(1, ...Object.values(p.stats));
  html += sectionTitle("ATTRIBUTS", true) + '<div class="card">';
  Object.keys(STATS).forEach((k) => {
    html += '<div class="stat-row"><span class="stat-name">' + STATS[k].label + '</span>' +
      '<div class="stat-bar"><div class="stat-fill" style="width:' + Math.round((p.stats[k] / maxStat) * 100) + '%"></div></div>' +
      '<span class="stat-val">' + p.stats[k] + "</span></div>";
  });
  html += "</div>";

  const week = weekReport();
  html += sectionTitle("RAPPORT DE LA SEMAINE", true) + '<div class="card">' +
    '<div class="p-grid gap-b">' +
    '<div><span class="p-num">' + (week.rate === null ? "—" : week.rate + "%") + '</span><span class="p-lb">Complétion</span></div>' +
    '<div><span class="p-num">' + week.xp + '</span><span class="p-lb">XP gagnée</span></div>' +
    '<div><span class="p-num">' + week.victories + '/7</span><span class="p-lb">Jours conquis</span></div>' +
    "</div>" +
    '<div class="advice">◈ ' + week.advice + "</div></div>";

  html += sectionTitle("28 DERNIERS JOURS", true) + '<div class="heat">';
  for (let i = 27; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = keyFor(d);
    const h = state.history[k] || {};
    const n = (h.done || []).length;
    const bg = n === 0 ? "rgba(160,110,255,.07)" : "rgba(160,110,255," + Math.min(0.22 + n * 0.18, 0.95) + ")";
    html += '<div class="heat-cell' + (h.victory ? " hv" : "") + '" style="background:' + bg + '" title="' + k + " : " + n + '"></div>';
  }
  html += "</div>";

  const notifState = !("Notification" in window) ? "unsupported" : Notification.permission;
  html += sectionTitle("PARAMÈTRES DU SYSTÈME", true);
  html += '<button class="settings-btn" data-act="notif">🔔 ' +
    (notifState === "granted" ? "Rappels activés ✓" : notifState === "denied" ? "Rappels bloqués — réactive-les dans les réglages du navigateur" : "Activer les rappels") +
    "</button>";
  html += '<div class="settings-note">Les rappels sonnent à l\'heure de chaque routine quand l\'app est ouverte ou récente en arrière-plan, plus un rappel quotidien automatique.</div>';
  html += '<button class="settings-btn" data-act="export">⬇ Exporter la sauvegarde (JSON)</button>';
  html += '<button class="settings-btn" data-act="import">⬆ Importer une sauvegarde</button>';
  html += '<div class="settings-note">Le Système v' + APP_VERSION + " · Données stockées uniquement sur cet appareil. Exporte régulièrement ta sauvegarde.</div>";
  return html;
}

function weekReport() {
  let xp = 0, victories = 0, done = 0, due = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = keyFor(d);
    const h = state.history[k];
    xp += (h && h.xp) || 0;
    if (h && h.victory) victories += 1;
    const dueThat = state.routines.filter((r) => r.days.includes(d.getDay()));
    due += dueThat.length;
    done += dueThat.filter((r) => ((h && h.done) || []).includes(r.id)).length;
  }
  const rate = due > 0 ? Math.round((done / due) * 100) : null;
  let advice = "Crée tes routines pour lancer le rapport.";
  if (rate !== null) {
    if (rate >= 80) advice = "Constance excellente. Monte le rang d'une routine ou attaque une quête de rang supérieur.";
    else if (rate >= 50) advice = "Bonne base. Identifie LA routine que tu rates le plus et baisse son exigence de 50% plutôt que de l'abandonner.";
    else advice = "Trop de charge. Réduis à 2–3 routines maximum et sécurise la série avant d'en rajouter.";
  }
  return { xp, victories, rate, advice };
}

/* ===== fenêtres système (modales) ===== */
function sysWindow(inner, extraClass) {
  return '<div class="overlay" data-act="overlay"><div class="sys-window ' + (extraClass || "") + '" data-stop="1">' +
    '<div class="sys-corner tl"></div><div class="sys-corner tr"></div><div class="sys-corner bl"></div><div class="sys-corner br"></div>' +
    inner + "</div></div>";
}

function showPenalty() {
  const pen = state._penalty;
  if (!pen) return;
  $("#modal").innerHTML = sysWindow(
    '<div class="sys-title warn">⚠ PÉNALITÉ</div>' +
    '<p class="sys-text">' + pen.count + " quête" + (pen.count > 1 ? "s" : "") + " journalière" + (pen.count > 1 ? "s" : "") + " non accomplie" + (pen.count > 1 ? "s" : "") + " hier.<br>−" + pen.xp + " XP · Série remise à zéro.</p>" +
    '<button class="sys-btn" data-act="penalty-ok">OK</button>',
    "warn-border"
  );
}

function rankRow(id, keys, selected) {
  return '<div class="rank-row" id="' + id + '">' +
    keys.map((k) => '<button class="rank-pick' + (k === selected ? " on" : "") + '" data-pick="single" data-val="' + k + '">' + k + "</button>").join("") +
    "</div>";
}

function dayRow(id, selected) {
  return '<div class="rank-row" id="' + id + '">' +
    DAYS.map((d, i) => '<button class="rank-pick' + (selected.includes(i) ? " on" : "") + '" data-pick="multi" data-val="' + i + '">' + d + "</button>").join("") +
    "</div>";
}

function statRow(id, selected) {
  return '<div class="rank-row" id="' + id + '">' +
    Object.keys(STATS).map((k) =>
      '<button class="stat-pick' + (k === selected ? " on" : "") + '" data-pick="single" data-val="' + k + '"><span>' + STATS[k].label + '</span><span class="stat-hint">' + STATS[k].hint + "</span></button>"
    ).join("") + "</div>";
}

function showQuestForm(editId) {
  editingQuest = editId || null;
  const q = editId ? state.quests.find((x) => x.id === editId) : null;
  const count = activeQuests().length;
  let subsHTML = "";
  if (q && q.subs.length) {
    q.subs.forEach((s) => {
      subsHTML += '<input class="f-input qf-sub" data-sid="' + s.id + '" value="' + esc(s.title) + '">';
    });
  } else {
    subsHTML = '<input class="f-input qf-sub" placeholder="Étape 1 (ex : Réviser chapitre 3)">';
  }
  const inner =
    '<div class="sys-title">' + (q ? "MODIFIER LA QUÊTE" : "NOUVELLE QUÊTE") + '</div><div class="form-body">' +
    (!q && count >= 3 ? '<div class="warn-box">⚠ Tu as déjà ' + count + " quêtes actives. Chaque quête ouverte divise ton focus.</div>" : "") +
    '<label class="f-label">Objectif</label><input class="f-input" id="qf-title" placeholder="Ex : Valider le S1 du Master CCA" value="' + (q ? esc(q.title) : "") + '">' +
    '<label class="f-label">Rang de difficulté</label>' + rankRow("qf-rank", Object.keys(QUEST_RANKS), q ? q.rank : "D") +
    '<label class="f-label">Attribut nourri</label>' + statRow("qf-stat", q ? q.stat || "INT" : "INT") +
    '<label class="f-label">Deadline (optionnel)</label><input class="f-input" id="qf-deadline" type="date" value="' + (q ? esc(q.deadline || "") : "") + '">' +
    '<label class="f-label">Sous-quêtes' + (q ? " — vide un champ pour supprimer l'étape" : " — commence par un verbe d'action") + "</label>" +
    '<div id="qf-subs">' + subsHTML + "</div>" +
    '<button class="add-sub" data-act="add-sub">+ Ajouter une étape</button>' +
    '</div><div class="btn-row"><button class="sys-btn ghost" data-act="close-modal">Annuler</button><button class="sys-btn" data-act="save-quest">' + (q ? "Enregistrer" : "Créer") + "</button></div>";
  $("#modal").innerHTML = sysWindow(inner, "form");
}

function showRoutineForm(editId) {
  editingRoutine = editId || null;
  const r = editId ? state.routines.find((x) => x.id === editId) : null;
  const inner =
    '<div class="sys-title">' + (r ? "MODIFIER LA ROUTINE" : "NOUVELLE ROUTINE") + '</div><div class="form-body">' +
    '<label class="f-label">Routine</label><input class="f-input" id="rf-title" placeholder="Ex : Street workout 30 min" value="' + (r ? esc(r.title) : "") + '">' +
    '<label class="f-label">Jours</label>' + dayRow("rf-days", r ? r.days : [0, 1, 2, 3, 4, 5, 6]) +
    '<label class="f-label">Heure de rappel (optionnel)</label><input class="f-input" id="rf-time" type="time" value="' + (r ? esc(r.time || "") : "") + '">' +
    '<label class="f-label">Attribut nourri</label>' + statRow("rf-stat", r ? r.stat || "VOL" : "VOL") +
    '<label class="f-label">Rang (XP gagnée)</label>' + rankRow("rf-rank", Object.keys(ROUTINE_XP), r ? r.rank : "E") +
    '</div><div class="btn-row"><button class="sys-btn ghost" data-act="close-modal">Annuler</button><button class="sys-btn" data-act="save-routine">' + (r ? "Enregistrer" : "Créer") + "</button></div>";
  $("#modal").innerHTML = sysWindow(inner, "form");
}

function closeModal() { $("#modal").innerHTML = ""; editingQuest = null; editingRoutine = null; }

function pickedSingle(containerId) {
  const el = document.querySelector("#" + containerId + " .on");
  return el ? el.dataset.val : null;
}
function pickedMulti(containerId) {
  return [...document.querySelectorAll("#" + containerId + " .on")].map((el) => Number(el.dataset.val));
}

function saveQuestFromForm() {
  const title = ($("#qf-title").value || "").trim();
  if (!title) return;
  const existing = editingQuest ? state.quests.find((x) => x.id === editingQuest) : null;
  const subs = [];
  [...document.querySelectorAll(".qf-sub")].forEach((inp) => {
    const t = inp.value.trim();
    if (!t) return;
    const sid = inp.dataset.sid;
    const old = sid && existing ? existing.subs.find((s) => s.id === sid) : null;
    subs.push(old ? { id: old.id, title: t, done: old.done } : { id: uid(), title: t, done: false });
  });
  const payload = {
    title,
    rank: pickedSingle("qf-rank") || "D",
    stat: pickedSingle("qf-stat") || "INT",
    deadline: $("#qf-deadline").value || "",
    subs,
  };
  if (existing) Object.assign(existing, payload);
  else state.quests.push(Object.assign({ id: uid() }, payload));
  const wasEdit = !!existing;
  editingQuest = null;
  save(); closeModal(); render();
  toast(wasEdit ? "QUÊTE MODIFIÉE" : "NOUVELLE QUÊTE", title);
}

function saveRoutineFromForm() {
  const title = ($("#rf-title").value || "").trim();
  const days = pickedMulti("rf-days");
  if (!title || days.length === 0) return;
  const existing = editingRoutine ? state.routines.find((x) => x.id === editingRoutine) : null;
  const payload = {
    title, days,
    time: $("#rf-time").value || "",
    stat: pickedSingle("rf-stat") || "VOL",
    rank: pickedSingle("rf-rank") || "E",
  };
  if (existing) Object.assign(existing, payload);
  else state.routines.push(Object.assign({ id: uid() }, payload));
  const wasEdit = !!existing;
  editingRoutine = null;
  save(); closeModal(); render();
  toast(wasEdit ? "ROUTINE MODIFIÉE" : "ROUTINE ACTIVÉE", title);
  checkReminders();
}

/* ===== export / import ===== */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "systeme-sauvegarde-" + todayKey() + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("SAUVEGARDE EXPORTÉE", "Fichier JSON téléchargé");
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const loaded = JSON.parse(reader.result);
      state = dailyReset(mergeData(loaded));
      save(); render();
      toast("SAUVEGARDE IMPORTÉE", "Le Système a restauré tes données");
    } catch (e) {
      toast("ERREUR", "Fichier de sauvegarde invalide");
    }
  };
  reader.readAsText(file);
}

/* ===== notifications ===== */
function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts = { body, icon: "./icon-192.png", badge: "./icon-192.png" };
  if (swReg && swReg.showNotification) swReg.showNotification(title, opts);
  else { try { new Notification(title, opts); } catch (e) {} }
}

async function enableNotifs() {
  if (!("Notification" in window)) { toast("NON SUPPORTÉ", "Ce navigateur ne gère pas les notifications"); return; }
  const p = await Notification.requestPermission();
  render();
  if (p === "granted") {
    notify("⚔ SYSTÈME ACTIVÉ", "Les rappels sont opérationnels, chasseur.");
    schedulePeriodicSync();
  }
}

async function schedulePeriodicSync() {
  if (!swReg || !("periodicSync" in swReg)) return;
  try {
    const status = await navigator.permissions.query({ name: "periodic-background-sync" });
    if (status.state === "granted") {
      await swReg.periodicSync.register("daily-quests", { minInterval: 12 * 60 * 60 * 1000 });
    }
  } catch (e) {}
}

function checkReminders() {
  if (!state || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const dow = now.getDay();
  const t = todayKey();
  const day = (state.history[t] = state.history[t] || { done: [] });
  day.notified = day.notified || [];
  let changed = false;
  state.routines.forEach((r) => {
    if (!r.time || !r.days.includes(dow)) return;
    const parts = r.time.split(":");
    const rt = Number(parts[0]) * 60 + Number(parts[1]);
    if (cur >= rt && !day.done.includes(r.id) && !day.notified.includes(r.id)) {
      if (cur - rt <= 60) notify("⏰ QUÊTE JOURNALIÈRE", r.title);
      day.notified.push(r.id);
      changed = true;
    }
  });
  if (changed) save();
}

/* ===== évènements ===== */
document.addEventListener("click", (e) => {
  const pick = e.target.closest("[data-pick]");
  if (pick) {
    if (pick.dataset.pick === "multi") {
      pick.classList.toggle("on");
    } else {
      [...pick.parentElement.children].forEach((el) => el.classList.remove("on"));
      pick.classList.add("on");
    }
    return;
  }
  const stop = e.target.closest("[data-stop]");
  const actEl = e.target.closest("[data-act]");
  if (!actEl) {
    if (!stop && e.target.closest(".overlay")) closeModal();
    return;
  }
  const act = actEl.dataset.act;
  switch (act) {
    case "tab": tab = actEl.dataset.tab; openQuest = null; render(); break;
    case "fab": tab === "routines" ? showRoutineForm() : showQuestForm(); break;
    case "toggle-routine": toggleRoutine(actEl.dataset.r); break;
    case "toggle-sub": toggleSub(actEl.dataset.q, actEl.dataset.s); break;
    case "star": setPriority(actEl.dataset.q); break;
    case "open-quest":
      if (tab === "home") { tab = "quests"; openQuest = actEl.dataset.q; }
      else openQuest = openQuest === actEl.dataset.q ? null : actEl.dataset.q;
      render(); break;
    case "del-quest": deleteQuest(actEl.dataset.q); break;
    case "del-routine": deleteRoutine(actEl.dataset.r); break;
    case "edit-quest": showQuestForm(actEl.dataset.q); break;
    case "edit-routine": showRoutineForm(actEl.dataset.r); break;
    case "close-modal": closeModal(); break;
    case "overlay": if (e.target === actEl) closeModal(); break;
    case "save-quest": saveQuestFromForm(); break;
    case "save-routine": saveRoutineFromForm(); break;
    case "add-sub": {
      const box = $("#qf-subs");
      const input = document.createElement("input");
      input.className = "f-input qf-sub";
      input.placeholder = "Étape " + (box.children.length + 1);
      box.appendChild(input);
      break;
    }
    case "penalty-ok": state._penalty = null; save(); closeModal(); break;
    case "notif": enableNotifs(); break;
    case "export": exportData(); break;
    case "import": $("#import-file").click(); break;
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "import-file" && e.target.files && e.target.files[0]) {
    importData(e.target.files[0]);
    e.target.value = "";
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { maybeRollover(); checkReminders(); }
});

/* ===== init ===== */
function init() {
  state = dailyReset(load());
  save();
  render();
  if (state._penalty) showPenalty();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then((r) => {
      swReg = r;
      if ("Notification" in window && Notification.permission === "granted") schedulePeriodicSync();
    }).catch(() => {});
  }

  setInterval(() => { maybeRollover(); checkReminders(); }, 30000);
  checkReminders();
}

init();
