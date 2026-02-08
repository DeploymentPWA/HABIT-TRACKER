/*************************************************
 * DISCIPLINE TRACKER – STABLE & MANUAL START
 *************************************************/

/* ========= NOTIFICATIONS ========= */
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function notify(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

/* ========= SOUND ALERT ========= */
let soundPlayedForSlot = null;

function playAlertSound(slotKey) {
  if (soundPlayedForSlot === slotKey) return;

  const audio = new Audio(
    "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
  );
  audio.play().catch(() => {});
  soundPlayedForSlot = slotKey;
}
function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")} ${ampm}`;
}

/* ========= HELPERS ========= */
function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function formatNow() {
  return new Date().toLocaleString();
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

/* ========= STORAGE ========= */
function getLog() {
  return JSON.parse(localStorage.getItem(todayKey())) || [];
}

function saveLog(log) {
  localStorage.setItem(todayKey(), JSON.stringify(log));
}

/* ========= TIMETABLE ========= */
function getTimetable() {
  return JSON.parse(localStorage.getItem("timetable")) || [];
}

/* ========= CURRENT EVENT ========= */
function getCurrentMainEvent() {
  const now = nowMinutes();
  return getTimetable().find(e =>
    now >= toMinutes(e.start) && now < toMinutes(e.end)
  );
}

/* ========= HYDRATION (ONLY AFTER START) ========= */
function getActiveWaterEvent(mainEvent, entry) {
  if (!mainEvent || !entry || !entry.started) return null;

  const start = toMinutes(mainEvent.start);
  const elapsed = nowMinutes() - start;

  if (elapsed < 60) return null;

  const slot = Math.floor(elapsed / 60);
  const log = getLog();

  if (
    log.some(
      e =>
        e.name === "Drink Water" &&
        e.parent === mainEvent.name &&
        e.slot === slot
    )
  ) return null;

  const slotKey = `${todayKey()}_${mainEvent.name}_${slot}`;

  if (!localStorage.getItem("notified_" + slotKey)) {
    notify("💧 Drink Water", `Hydration break during ${mainEvent.name}`);
    localStorage.setItem("notified_" + slotKey, "yes");
  }

  playAlertSound(slotKey);

  return {
    name: "Drink Water",
    parent: mainEvent.name,
    slot,
    startMinute: start + slot * 60
  };
}

/* ========= RENDER ========= */

function render() {
   syncLogsWithTimetable();

  const card = document.getElementById("eventCard");
  const phaseInfo = document.getElementById("phaseInfo");

  const mainEvent = getCurrentMainEvent();
  const log = getLog();

  if (!mainEvent) {
    card.innerHTML = `
      <h2>No scheduled block</h2>
    `;
    phaseInfo.innerText = "—";
    return;
  }

  phaseInfo.innerText = `Phase ${mainEvent.phase}`;

  const entry = log.find(e => e.name === mainEvent.name);

  /* ---- HYDRATION CARD ---- */
  const water = getActiveWaterEvent(mainEvent, entry);
  if (water) {
    card.innerHTML = `
      <h2>💧 Drink Water</h2>
      <p>${formatNow()}</p>
      <p>Inside: ${mainEvent.name}</p>
      <button class="start-btn"
        onclick="markMicro('${water.name}','${water.parent}',${water.slot},${water.startMinute})">
        ✔ Done
      </button>
    `;
    return;
  }

  /* ---- MAIN EVENT CARD ---- */
  card.innerHTML = `
    <h2>${mainEvent.name}</h2>
    <p>${formatNow()}</p>


    <p>${mainEvent.start} – ${mainEvent.end}</p>
    <p>Severity: ${mainEvent.severity}</p>

    ${
      !entry
        ? `<button class="start-btn"
             onclick="startMainEvent(
               '${mainEvent.name}',
               '${mainEvent.start}',
               ${mainEvent.phase},
               ${mainEvent.severity}
             )">
             ▶ Start Event
           </button>`
        : entry.score === null
          ? `<p>🟢 Started | Score: Pending</p>`
          : `<p>✅ Completed | Score: ${entry.score}</p>`
    }
  `;
}

/* ========= START / COMPLETE ========= */
function startMainEvent(name, start, phase, severity) {
  const log = getLog();
  if (log.some(e => e.name === name)) return;

  log.push({
    name,
    phase,
    severity,
    start,
    started: true,
    startedAt: nowMinutes(),
    delay: null,
    score: null
  });

  saveLog(log);
  render();
}

function finalizeMainEvent(entry) {
  const delay = Math.max(0, entry.startedAt - toMinutes(entry.start));
  let score = 0;

  if (delay <= 15) {
    score = entry.severity * 10 - delay;
    if (score < 0) score = 0;
  }

  entry.delay = delay;
  entry.score = score;
}

/* ========= MICRO HABIT ========= */
function markMicro(name, parent, slot, startMinute) {
  const log = getLog();

  const delay = Math.max(0, nowMinutes() - startMinute);
  const score = delay <= 15 ? 10 - delay : 0;

  log.push({
    name,
    parent,
    slot,
    phase: "micro",
    severity: 1,
    delay,
    score
  });

  saveLog(log);
  render();
}

/* ========= AUTO MISS (STRICT) ========= */
function autoMiss() {
  const now = nowMinutes();
  const log = getLog();

  getTimetable().forEach(e => {
    const entry = log.find(l => l.name === e.name);

    if (now >= toMinutes(e.end) && !entry) {
      log.push({
        name: e.name,
        phase: e.phase,
        severity: e.severity,
        delay: 999,
        score: 0,
        autoMissed: true
      });
    }

    if (
      entry &&
      entry.started &&
      entry.score === null &&
      now >= toMinutes(e.end)
    ) {
      finalizeMainEvent(entry);
    }
  });

  saveLog(log);
}

/* ========= NAV ========= */
document.getElementById("historyBtn").onclick = () =>
  location.href = "history.html";
document.getElementById("statsBtn").onclick = () =>
  location.href = "stats.html";

/* ========= INIT ========= */
requestNotificationPermission();
render();

setInterval(() => {
  autoMiss();
  render();
}, 30000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") render();
});
function updateLiveClock() {
  const clock = document.getElementById("liveClock");
  if (!clock) return;

  const now = new Date();
  clock.innerHTML = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

// start live clock
updateLiveClock();
setInterval(updateLiveClock, 1000);

window.addEventListener("focus", () => {
  render();
});
function syncLogsWithTimetable() {
  const timetable = getTimetable();
  const validNames = timetable.map(e => e.name);

  const log = getLog();
  const cleaned = log.filter(e =>
    e.phase === "micro" || validNames.includes(e.name)
  );

  if (cleaned.length !== log.length) {
    saveLog(cleaned);
  }
}
window.addEventListener("storage", (e) => {
  if (e.key === "timetable" || e.key === "timetableUpdated") {
    render();
  }
});
