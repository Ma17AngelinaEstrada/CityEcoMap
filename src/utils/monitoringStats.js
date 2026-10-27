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
    }
  });

  return {
    schemaVersion: 1,
    totalReports: snapshot.size,
    statusCounts,
    categoryCounts,
    dailyTrend: Array.from(buckets.entries()).map(([ms, total]) => ({
      date: formatDay(ms),
      total,
    })),
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
      if (updated && Date.now() - updated.getTime() < maxAgeMs) return null;
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