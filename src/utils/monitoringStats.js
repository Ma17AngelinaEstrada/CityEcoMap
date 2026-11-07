import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

// Aggregate-only statistics for the EMB Monitoring Dashboard.
// Writes COUNTS ONLY to monitoringStats/current. No names, emails,
// descriptions, photos or exact locations are ever written here.

const TREND_WEEKS = 12;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // Asia/Manila is UTC+8, no DST
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_ALIASES = {
  pending: "Pending",
  approved: "Approved",
  ongoing: "Ongoing",
  "in progress": "Ongoing",
  resolved: "Resolved",
  rejected: "Rejected",
};

const CATEGORIES = ["Waste Issue", "Drainage Issue"];

const SCHEMA_VERSION = 2;
const BREAKDOWN_DAYS = 400;
const MAX_BREAKDOWN_ROWS = 8000;
const KNOWN_SUBCATEGORIES = {
  "Waste Issue": [
    "Illegal Dumping",
    "Uncollected Garbage",
    "Waste Affecting Rivers, Waterways, and Natural Water Bodies",
  ],
  "Drainage Issue": [
    "Clogged Drainage",
    "Blocked Drainage",
    "Damaged Drainage",
    "Flooding",
  ],
};

function normalizeStatus(value) {
  return STATUS_ALIASES[String(value || "").trim().toLowerCase()] || null;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Returns the Monday (Asia/Manila) of the week containing `date`, as a
// UTC-midnight timestamp of that Manila calendar day.
function weekStartMs(date) {
  const shifted = date.getTime() + MANILA_OFFSET_MS;
  const dayStart = Math.floor(shifted / DAY_MS) * DAY_MS;
  const dayOfWeek = new Date(dayStart).getUTCDay(); // 0 = Sunday
  const sinceMonday = (dayOfWeek + 6) % 7;
  return dayStart - sinceMonday * DAY_MS;
}

function formatDay(ms) {
  return new Date(ms).toISOString().slice(0, 10); // YYYY-MM-DD
}

// Manila calendar day (YYYY-MM-DD) of a Date.
function manilaDayString(date) {
  const shifted = date.getTime() + MANILA_OFFSET_MS;
  return formatDay(Math.floor(shifted / DAY_MS) * DAY_MS);
}

// Unknown / free-text subcategories are stored as "Other" (no free text).
function normalizeSubCategory(category, value) {
  return (KNOWN_SUBCATEGORIES[category] || []).includes(value) ? value : "Other";
}

function buildBreakdownRows(map) {
  const rows = Array.from(map.entries()).map(([key, n]) => {
    const [d, c, s, st] = key.split("|");
    return { d, c, s, st, n };
  });
  rows.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  return rows.slice(0, MAX_BREAKDOWN_ROWS);
}

export async function computeMonitoringStats(db) {
  // Server read so we never count from a stale local cache.
  const snapshot = await getDocsFromServer(collection(db, "reports"));

  const statusCounts = {
    Pending: 0,
    Approved: 0,
    Ongoing: 0,
    Resolved: 0,
    Rejected: 0,
  };
  const categoryCounts = { "Waste Issue": 0, "Drainage Issue": 0 };
  const breakdownMap = new Map();
  const breakdownCutoffMs = Date.now() - BREAKDOWN_DAYS * DAY_MS;

  const thisWeek = weekStartMs(new Date());
  const buckets = new Map();
  for (let i = TREND_WEEKS - 1; i >= 0; i -= 1) {
    buckets.set(thisWeek - i * 7 * DAY_MS, 0);
  }

  snapshot.forEach((d) => {
    const data = d.data();

    const status = normalizeStatus(data.status);
    if (status) statusCounts[status] += 1;

    if (CATEGORIES.includes(data.category)) {
      categoryCounts[data.category] += 1;
    }

    const created = toDate(data.createdAt);
    if (created) {
      const key = weekStartMs(created);
      if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);

      if (
        created.getTime() >= breakdownCutoffMs &&
        status &&
        CATEGORIES.includes(data.category)
      ) {
        const sub = normalizeSubCategory(data.category, data.subCategory);
        const bKey = [manilaDayString(created), data.category, sub, status].join("|");
        breakdownMap.set(bKey, (breakdownMap.get(bKey) || 0) + 1);
      }
    }
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    totalReports: snapshot.size,
    statusCounts,
    categoryCounts,
    dailyTrend: Array.from(buckets.entries()).map(([ms, total]) => ({
      date: formatDay(ms),
      total,
    })),
    breakdown: buildBreakdownRows(breakdownMap),
  };
}

// Master Admin only (enforced by Firestore rules). Never writes on error.
export async function recomputeMonitoringStats(db) {
  const stats = await computeMonitoringStats(db); // throws on failure -> no write
  await setDoc(doc(db, "monitoringStats", "current"), {
    ...stats,
    updatedAt: serverTimestamp(),
  });
  return stats;
}

const STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour
let refreshInFlight = null;

// Master Admin only. Recomputes only when the stats are missing or older
// than maxAgeMs. Failures are swallowed so they never affect the admin UI.
export function ensureFreshMonitoringStats(db, maxAgeMs = STALE_AFTER_MS) {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const snap = await getDocFromServer(doc(db, "monitoringStats", "current"));
      const updated = snap.exists() ? toDate(snap.data().updatedAt) : null;
      const schemaOk = snap.exists() && snap.data().schemaVersion >= SCHEMA_VERSION;
      if (schemaOk && updated && Date.now() - updated.getTime() < maxAgeMs) return null;
      return await recomputeMonitoringStats(db);
    } catch (err) {
      console.warn("Monitoring stats refresh skipped:", err && err.code ? err.code : "error");
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}