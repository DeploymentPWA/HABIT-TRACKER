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
  return getTimetable().filter(e =>
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


function render() {
    // Optimization: skip redraw if still in the same minute
    const currentMinute = nowMinutes();
    if (window.lastRenderMinute === currentMinute) {
        return; // do nothing - no need to redraw
    }
    window.lastRenderMinute = currentMinute;

    // ──────────────────────────────────────────────
    // everything else stays exactly the same
    // ──────────────────────────────────────────────

    syncLogsWithTimetable();

  const container = document.getElementById("mainContainer");
  const phaseInfo = document.getElementById("phaseInfo");

  if (!container) {
    console.error("mainContainer not found in HTML");
    return;
  }

  container.innerHTML = ""; // clear old content

  const activeEvents = getCurrentMainEvent();
  const log = getLog();
  const waterInfo = shouldShowWaterReminder();
if (waterInfo) {
  const waterCard = document.createElement("div");
  waterCard.className = "card";
  waterCard.innerHTML = `
    <h2>💧 Drink Water (Hour ${waterInfo.slot + 1})</h2>
    <p>${formatNow()}</p>
    <button class="start-btn" onclick="markWater(${waterInfo.slot}, ${waterInfo.startMinute})">
      ✔ Done
    </button>
  `;
  container.appendChild(waterCard);

  // Add notification and sound here to always trigger when card shows
  const slotKey = `${todayKey()}_daily_${waterInfo.slot}`;
  if (!localStorage.getItem("notified_" + slotKey)) {
    notify("💧 Drink Water", "Time for your hourly hydration!");
    localStorage.setItem("notified_" + slotKey, "yes");
  }
  playAlertSound(slotKey);
}

  if (activeEvents.length === 0) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h2>No scheduled block right now</h2>
      <p>Check your timetable</p>
    `;
    container.appendChild(card);
    phaseInfo.innerText = "—";
      // Independent daily hydration reminder
  const waterInfo = shouldShowWaterReminder();
  if (waterInfo) {
    const waterCard = document.createElement("div");
    waterCard.className = "card";
    waterCard.innerHTML = `
      <h2>💧 Drink Water (Hour ${waterInfo.slot + 1})</h2>
      <p>${formatNow()}</p>
      <button class="start-btn" onclick="markWater(${waterInfo.slot}, ${waterInfo.startMinute})">
        ✔ Done
      </button>
    `;
    container.appendChild(waterCard);
  }
  }

  phaseInfo.innerText = `Phase ${activeEvents.map(e => e.phase).join(', ')}`;

  activeEvents.forEach(event => {
    const entry = log.find(e => e.name === event.name);
    const entryStatus = entry 
      ? (entry.score === null ? "🟢 Started | Score: Pending" : `✅ Completed | Score: ${entry.score}`)
      : '';

    // Main event card
    const eventCard = document.createElement("div");
    eventCard.className = "card";
    eventCard.innerHTML = `
      <h2>${event.name}</h2>
      <p>${formatNow()}</p>
      <p>${event.start} – ${event.end}</p>
      <p>Severity: ${event.severity}</p>
      ${entryStatus ? `<p>${entryStatus}</p>` : ''}
      ${!entry ? `
        <button class="start-btn" 
                onclick="startMainEvent('${event.name}', '${event.start}', ${event.phase}, ${event.severity})">
          ▶ Start Event
        </button>
      ` : ''}
    `;
    container.appendChild(eventCard);

    // Separate hydration card (only if applicable)
    const water = getActiveWaterEvent(event, entry);
    if (water) {
      const waterCard = document.createElement("div");
      waterCard.className = "card";
      waterCard.innerHTML = `
        <h2>💧 Drink Water</h2>
        <p>${formatNow()}</p>
        <p>During: ${event.name}</p>
        <button class="start-btn" onclick="markMicro('${water.name}','${water.parent}',${water.slot},${water.startMinute})">
          ✔ Done
        </button>
      `;
      container.appendChild(waterCard);
    }
  });
  // New: Finalize any pending past events in real-time
activeEvents.forEach(event => {
  const entry = log.find(e => e.name === event.name);
  if (entry && entry.started && entry.score === null && nowMinutes() >= toMinutes(event.end)) {
    finalizeMainEvent(entry);
    saveLog(log);
  }
});
// Force finalize any ended event with pending score during render
activeEvents.forEach(event => {
  const entry = log.find(e => e.name === event.name);
  if (entry && entry.started && entry.score === null && nowMinutes() >= toMinutes(event.end)) {
    finalizeMainEvent(entry);
    saveLog(log);
  }
});

}

// Ensure the buttons are clickable by adding event listeners again after rendering new events.
function bindEventButtons() {
  const startButtons = document.querySelectorAll(".start-btn");
  startButtons.forEach(button => {
    button.addEventListener("click", (e) => {
      const eventName = e.target.getAttribute("data-event-name");
      const eventStart = e.target.getAttribute("data-event-start");
      const eventPhase = e.target.getAttribute("data-event-phase");
      const eventSeverity = e.target.getAttribute("data-event-severity");

      // Trigger the start event
      startMainEvent(eventName, eventStart, eventPhase, eventSeverity);
    });
  });
}



  /* ---- MAIN EVENT CARD ---- */


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
  const timetable = getTimetable();

  timetable.forEach(event => {
    const entry = log.find(l => l.name === event.name);

    if (now >= toMinutes(event.end) && !entry) {
      log.push({
        name: event.name,
        phase: event.phase,
        severity: event.severity,
        delay: 999, // mark entire time as wasted
        score: 0,
        autoMissed: true
      });
    }

    if (entry && entry.started && entry.score === null && now >= toMinutes(event.end)) {
      finalizeMainEvent(entry);
    }
  });

  saveLog(log);
}

/* ========= NAV ========= */
document.getElementById("historyBtn").onclick = () => {
  window.location.href = "history.html";
};

document.getElementById("statsBtn").onclick = () => {
  window.location.href = "stats.html";
};

/* ========= INIT ========= */



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

// ================= TIMETABLE-BASED HYDRATION & DAY BOUNDARY =================

function getDayStartMinute() {
  const tt = getTimetable();
  if (tt.length === 0) return null;
  return Math.min(...tt.map(e => toMinutes(e.start)));
}

function getDayEndMinute() {
  const tt = getTimetable();
  if (tt.length === 0) return null;
  return Math.max(...tt.map(e => toMinutes(e.end)));
}

function getCurrentWaterSlot() {
  const dayStart = getDayStartMinute();
  if (dayStart === null) return null;

  const now = nowMinutes();
  if (now < dayStart) return null;

  const elapsed = now - dayStart;
  return Math.floor(elapsed / 60);
}

function shouldShowWaterReminder() {
  const dayStart = getDayStartMinute();
  if (dayStart === null) return null;

  const now = nowMinutes();
  if (now < dayStart) return null;

  const dayEnd = getDayEndMinute();
  if (dayEnd !== null && now >= dayEnd) return null;  // Stop after last event ends

  const elapsed = now - dayStart;
  const slot = Math.floor(elapsed / 60);

  if (slot < 1) return null;

  const lastMarked = localStorage.getItem("lastWaterSlot_" + todayKey());
  if (lastMarked === String(slot)) return null;

  const startMin = dayStart + slot * 60;

  return { slot, startMinute: startMin };
}
function markWaterDone(slot) {
  localStorage.setItem("lastWaterSlot_" + todayKey(), String(slot));
  render();
}

function markWater(slot, startMinute) {
  const delay = Math.max(0, nowMinutes() - startMinute);
  const score = delay <= 15 ? 10 - delay : 0;

  const log = getLog();
  log.push({
    name: "Drink Water",
    parent: "Daily Hydration",
    slot,
    phase: "hydration",
    severity: 1,
    delay,
    score
  });
  saveLog(log);

  markWaterDone(slot);
  render();
}



// ──────────────────────────────────────────────
// LIVE UPDATES – clock + events + hydration + auto-miss
// ──────────────────────────────────────────────

function updateLiveUI() {
    updateLiveClock();     // refresh clock
    autoMiss();            // check for missed/ended events
    render();              // update screen
}

// First run when page loads
requestNotificationPermission();
updateLiveUI();

// Update every 15 seconds (smooth + battery friendly)
setInterval(updateLiveUI, 15 * 1000);

// Refresh when user returns to this tab
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        updateLiveUI();
    }
});

// Extra refresh on focus (helps in some browsers)
window.addEventListener("focus", updateLiveUI);

// Keep listening for timetable changes from admin page
window.addEventListener("storage", (e) => {
    if (e.key === "timetable" || e.key === "timetableUpdated") {
        updateLiveUI();
    }
});
