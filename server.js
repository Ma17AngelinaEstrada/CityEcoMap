const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1); // Render runs behind one reverse proxy

// ---------- Configuration ----------
const BREVO_API_KEY = process.env.BREVO_API_KEY; // secret: environment variable only
const SENDER_EMAIL = 'cityecomap.lucena@gmail.com';
const SENDER_NAME = 'CityEcoMap';

// Public identifiers (not secrets)
const FIREBASE_PROJECT_ID = 'cityecomap';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const ALLOWED_ORIGINS = [
  'https://cityecomap.web.app',
  'https://cityecomap.firebaseapp.com',
  'http://localhost:3000', // development only; remove if not needed
];

// Brevo Free plan shows "300 emails per day" on the dashboard. This in-memory cap (shared
// by /notify and /notify-admins) is only a safety brake kept below that limit; Brevo itself
// is the real enforcement.
const parsedCap = Number.parseInt(process.env.EMAIL_DAILY_CAP || '', 10);
const DAILY_EMAIL_CAP = Number.isInteger(parsedCap) && parsedCap > 0 ? parsedCap : 250;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;

// New-report notification to office admins (POST /notify-admins).
// Recipients live ONLY in Render environment variables, as comma-separated emails:
//   NOTIFY_ADMIN_EMAILS_CENRO, NOTIFY_ADMIN_EMAILS_CITY_ENGINEERING, NOTIFY_ADMIN_EMAILS_MASTER
const NEW_REPORT_WINDOW_MS = 10 * 60 * 1000; // a report qualifies only if created this recently
const MAX_RECIPIENTS_PER_OFFICE = 10;
const parsedHourly = Number.parseInt(process.env.NOTIFY_ADMINS_HOURLY_CAP || '', 10);
const NOTIFY_ADMINS_HOURLY_CAP = Number.isInteger(parsedHourly) && parsedHourly > 0 ? parsedHourly : 20;
const rawAppUrl = (process.env.ADMIN_APP_URL || '').trim().replace(/\/+$/, '');
const ADMIN_APP_URL =
  /^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(rawAppUrl) || /^http:\/\/localhost(:\d+)?$/.test(rawAppUrl)
    ? rawAppUrl
    : 'https://cityecomap.web.app';
// Office name stored on reports -> environment variable that holds its recipients.
const RECIPIENT_ENV_BY_OFFICE = {
  CENRO: 'NOTIFY_ADMIN_EMAILS_CENRO',
  'City Engineering': 'NOTIFY_ADMIN_EMAILS_CITY_ENGINEERING',
  EMB: 'NOTIFY_ADMIN_EMAILS_MASTER', // Master Admin's office
};

// Local testing only: do not call Brevo. Never set this in production.
const EMAIL_DRY_RUN = process.env.EMAIL_DRY_RUN === 'true';

// Role values as stored in admins/{uid}.role (see src/constants/offices.js).
// Keep in sync with the app. EMB Admin is intentionally absent: monitoring only.
const MASTER_ROLE = 'Master Admin';
const OFFICE_BY_ROLE = {
  'CENRO Admin': 'CENRO',
  'City Engineering Admin': 'City Engineering',
};

// ---------- Helpers ----------
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const DOC_ID_RE = /^[A-Za-z0-9]{10,40}$/;

const KIND_TO_STATUS = {
  approved: ['Approved'],
  rejected: ['Rejected'],
  ongoing: ['Ongoing', 'In Progress'],
  resolved: ['Resolved'],
};

function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => map[c]);
}

function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value);
}

// In-memory counter: resets on restart/redeploy/spin-down and is not shared between
// instances. It is a brake against mistakes and abuse, not quota accounting.
let dayKey = '';
let sentToday = 0;
function takeDailySlot() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  if (today !== dayKey) { dayKey = today; sentToday = 0; }
  if (sentToday >= DAILY_EMAIL_CAP) return false;
  sentToday += 1;
  return true;
}
function releaseDailySlot() {
  if (sentToday > 0) sentToday -= 1;
}

// In-memory duplicate guard (same limitations as the counter above)
const recentSends = new Map();
function wasSentRecently(key) {
  const now = Date.now();
  for (const [k, t] of recentSends) {
    if (now - t > DEDUPE_WINDOW_MS) recentSends.delete(k);
  }
  return recentSends.has(key);
}

async function sendViaBrevo(to, subject, htmlContent) {
  if (EMAIL_DRY_RUN) {
    console.log('[dry-run] email not sent');
    return { ok: true, dryRun: true };
  }
  if (!BREVO_API_KEY) {
    console.error('BREVO_API_KEY is not configured.');
    return { ok: false };
  }
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Log only the status and Brevo's error code. Never log recipients or keys.
    console.error('Brevo API error:', response.status, errorData && errorData.code ? errorData.code : '');
    return { ok: false };
  }
  return { ok: true };
}

function fieldString(doc, name) {
  const f = doc && doc.fields && doc.fields[name];
  return f && typeof f.stringValue === 'string' ? f.stringValue : '';
}

// Only reads the uid claim. The signature is verified by Firestore itself when this
// same token is used in the requests below (an invalid token gets 401).
function uidFromToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    const uid = payload.user_id || payload.sub;
    return typeof uid === 'string' && /^[A-Za-z0-9]{6,128}$/.test(uid) ? uid : null;
  } catch (e) {
    return null;
  }
}

async function firestoreGet(path, idToken) {
  const headers = { Accept: 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const response = await fetch(`${FIRESTORE_BASE}/${path}`, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const doc = response.status === 200 ? await response.json() : null;
  return { status: response.status, doc };
}

// Layer 1: positively verify the caller is an Active admin whose role may notify.
async function getAdminIdentity(idToken) {
  const uid = uidFromToken(idToken);
  if (!uid) return { error: 'unauthenticated' };
  const r = await firestoreGet(`admins/${uid}`, idToken);
  if (r.status === 401) return { error: 'unauthenticated' };
  if (r.status !== 200) {
    return { error: r.status === 403 || r.status === 404 ? 'forbidden' : 'unavailable' };
  }
  const status = fieldString(r.doc, 'status');
  const role = fieldString(r.doc, 'role');
  if (status !== 'Active') return { error: 'forbidden' };
  if (role !== MASTER_ROLE && !OFFICE_BY_ROLE[role]) return { error: 'forbidden' };
  return { uid, role, office: OFFICE_BY_ROLE[role] || null, isMaster: role === MASTER_ROLE };
}

// The reports collection is publicly readable by the existing rules.
async function loadReport(docId) {
  const r = await firestoreGet(`reports/${docId}`, null);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error(`Firestore ${r.status}`);
  return {
    reportId: fieldString(r.doc, 'reportId'),
    status: fieldString(r.doc, 'status'),
    email: fieldString(r.doc, 'email'),
    primaryOffice: fieldString(r.doc, 'primaryOffice'),
    rejectionReason: fieldString(r.doc, 'rejectionReason').slice(0, 500),
  };
}

// Layer 2 + 3. Layer 2: only Master Admin, or the admin of the report's CURRENT
// primaryOffice, may notify. Supporting offices, jurisdiction candidates and reroute
// targets do not authorize anything by themselves. Layer 3: the Firestore rules must
// also agree (anything other than 200 on private/contact is a denial).
async function verifyReportAccess(admin, report, docId, idToken) {
  if (!admin.isMaster) {
    if (!report.primaryOffice || report.primaryOffice !== admin.office) return 'forbidden';
  }
  const r = await firestoreGet(`reports/${docId}/private/contact`, idToken);
  // Only a positive read (200) counts. 404 (no contact doc) is NOT accepted.
  if (r.status === 200) return 'ok';
  if (r.status === 404) return 'forbidden';
  if (r.status === 401) return 'unauthenticated';
  if (r.status === 403) return 'forbidden';
  return 'unavailable';
}

const SIGNATURE = '<br/><p>&mdash; CityEcoMap Team</p>';

function buildEmail(kind, report) {
  const id = escapeHtml(report.reportId);
  switch (kind) {
    case 'approved':
      return {
        subject: 'Your CityEcoMap Report Has Been Approved',
        html:
          '<p>Dear Citizen,</p>' +
          `<p>Your report <strong>#${id}</strong> has been reviewed and approved.</p>` +
          (report.primaryOffice
            ? `<p>It is being handled by <strong>${escapeHtml(report.primaryOffice)}</strong>.</p>`
            : '') +
          '<p>Thank you for helping keep Lucena City clean!</p>' +
          `<p>You can also check your report's progress anytime using your Report ID <strong>#${id}</strong> on our Track Report page.</p>` +
          SIGNATURE,
      };
    case 'rejected':
      return {
        subject: 'Update on Your CityEcoMap Report',
        html:
          '<p>Dear Citizen,</p>' +
          `<p>Your report <strong>#${id}</strong> has been reviewed but could not be approved.</p>` +
          (report.rejectionReason
            ? `<p><strong>Reason:</strong> ${escapeHtml(report.rejectionReason)}</p>`
            : '') +
          '<p>If you believe this is an error, please submit a new report with clearer details.</p>' +
          `<p>You can also check your report's status anytime using your Report ID <strong>#${id}</strong> on our Track Report page.</p>` +
          SIGNATURE,
      };
    case 'ongoing':
      return {
        subject: 'Cleanup in Progress — CityEcoMap Report Update',
        html:
          '<p>Dear Citizen,</p>' +
          `<p>Good news! Cleanup is now in progress for your report <strong>#${id}</strong>.</p>` +
          '<p>Our team is actively working on resolving the issue. Thank you for your patience.</p>' +
          `<p>You can also check your report's progress anytime using your Report ID <strong>#${id}</strong> on our Track Report page.</p>` +
          SIGNATURE,
      };
    case 'resolved':
      return {
        subject: 'Your Report Has Been Resolved — CityEcoMap',
        html:
          '<p>Dear Citizen,</p>' +
          `<p>Your report <strong>#${id}</strong> has been successfully resolved.</p>` +
          '<p>Thank you for helping us build a cleaner, greener Lucena City!</p>' +
          `<p>You can view the full details of your resolved report anytime using your Report ID <strong>#${id}</strong> on our Track Report page.</p>` +
          SIGNATURE,
      };
    default:
      return null;
  }
}

// ---------- New-report notification helpers ----------
function getRecipients(office) {
  const envName = RECIPIENT_ENV_BY_OFFICE[office];
  if (!envName) return [];
  const seen = new Set();
  const list = [];
  let ignored = 0;
  for (const part of String(process.env[envName] || '').split(',')) {
    const email = part.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (!isValidEmail(email)) { ignored += 1; continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    if (list.length < MAX_RECIPIENTS_PER_OFFICE) list.push(email); else ignored += 1;
  }
  // Count only; never log the addresses themselves.
  if (ignored > 0) console.warn(`[notify-admins] ignored ${ignored} invalid or excess entries in ${envName}`);
  return list;
}

// Rolling one-hour cap (in memory; resets when the server restarts).
const hourlySlots = [];
function takeHourlySlot() {
  const now = Date.now();
  while (hourlySlots.length && now - hourlySlots[0] > 60 * 60 * 1000) hourlySlots.shift();
  if (hourlySlots.length >= NOTIFY_ADMINS_HOURLY_CAP) return null;
  hourlySlots.push(now);
  return now;
}
function releaseHourlySlot(token) {
  const i = hourlySlots.lastIndexOf(token);
  if (i !== -1) hourlySlots.splice(i, 1);
}

// One notification per report (in memory; the 10-minute window above limits the exposure).
const adminNotified = new Map();
function pruneAdminNotified() {
  const now = Date.now();
  for (const [k, t] of adminNotified) {
    if (now - t > 30 * 60 * 1000) adminNotified.delete(k);
  }
}

function fsField(doc, name) {
  return doc && doc.fields ? doc.fields[name] : undefined;
}
function fsBool(doc, name) {
  const f = fsField(doc, name);
  return !!(f && f.booleanValue === true);
}
function fsStringArray(doc, name) {
  const f = fsField(doc, name);
  const values = f && f.arrayValue && Array.isArray(f.arrayValue.values) ? f.arrayValue.values : [];
  return values.map((v) => (v && typeof v.stringValue === 'string' ? v.stringValue : '')).filter(Boolean);
}
function fsArrayLength(doc, name) {
  const f = fsField(doc, name);
  return f && f.arrayValue && Array.isArray(f.arrayValue.values) ? f.arrayValue.values.length : 0;
}
function fsTimestampMs(doc, name) {
  const f = fsField(doc, name);
  if (!f || typeof f.timestampValue !== 'string') return null;
  const t = Date.parse(f.timestampValue);
  return Number.isNaN(t) ? null : t;
}
function fsLocation(doc) {
  const f = fsField(doc, 'location');
  const m = f && f.mapValue && f.mapValue.fields;
  if (!m) return null;
  const num = (v) => {
    if (!v) return NaN;
    if (v.doubleValue !== undefined) return Number(v.doubleValue);
    if (v.integerValue !== undefined) return Number(v.integerValue);
    return NaN;
  };
  const lat = num(m.lat);
  const lng = num(m.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}

// Only these fields are requested. The citizen's name, email and contact number are never read.
const NEW_REPORT_FIELDS = [
  'reportId', 'status', 'category', 'subCategory', 'areaType', 'description', 'addressInput',
  'locationDescription', 'location', 'createdAt', 'primaryOffice', 'needsReview',
  'jurisdictionCandidates', 'photos',
];
async function loadNewReport(docId) {
  const mask = NEW_REPORT_FIELDS.map((f) => `mask.fieldPaths=${f}`).join('&');
  const r = await firestoreGet(`reports/${docId}?${mask}`, null); // existing public read
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error(`Firestore ${r.status}`);
  const d = r.doc;
  return {
    reportId: fieldString(d, 'reportId'),
    status: fieldString(d, 'status'),
    category: fieldString(d, 'category'),
    subCategory: fieldString(d, 'subCategory'),
    areaType: fieldString(d, 'areaType'),
    description: fieldString(d, 'description'),
    addressInput: fieldString(d, 'addressInput'),
    locationDescription: fieldString(d, 'locationDescription'),
    location: fsLocation(d),
    createdAtMs: fsTimestampMs(d, 'createdAt'),
    primaryOffice: fieldString(d, 'primaryOffice'),
    needsReview: fsBool(d, 'needsReview'),
    jurisdictionCandidates: fsStringArray(d, 'jurisdictionCandidates'),
    photoCount: fsArrayLength(d, 'photos'),
  };
}

// primaryOffice -> that office. Otherwise needsReview -> Master. Otherwise only the offices
// currently listed in jurisdictionCandidates.
function selectNotifyOffices(report) {
  if (report.primaryOffice) return RECIPIENT_ENV_BY_OFFICE[report.primaryOffice] ? [report.primaryOffice] : [];
  if (report.needsReview) return ['EMB'];
  return [...new Set(report.jurisdictionCandidates)].filter((o) => o !== 'EMB' && RECIPIENT_ENV_BY_OFFICE[o]);
}

function cleanLine(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function buildNewReportSubject(report) {
  const category = cleanLine(report.category, 40).replace(/\s+issue$/i, '');
  const issue = cleanLine(report.subCategory, 80);
  if (!category) return 'New CityEcoMap Report';
  return issue ? `New ${category} Report – ${issue}` : `New ${category} Report`;
}

function formatManila(ms) {
  try {
    return `${new Date(ms).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })} (PH time)`;
  } catch (e) {
    return new Date(ms).toISOString();
  }
}

function detailRow(label, valueHtml) {
  return (
    '<tr>' +
    `<td style="padding:6px 14px 6px 0;color:#555;vertical-align:top">${label}</td>` +
    `<td style="padding:6px 0;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;word-break:break-word">${valueHtml}</td>` +
    '</tr>'
  );
}

function buildNewReportEmail(docId, report) {
  const link = `${ADMIN_APP_URL}/admin/reports?report=${docId}`;
  let routing;
  if (report.primaryOffice) routing = `Assigned office: <strong>${escapeHtml(report.primaryOffice)}</strong>`;
  else if (report.needsReview) routing = '<strong>Needs manual review</strong>';
  else routing = `Needs jurisdiction verification: <strong>${escapeHtml(report.jurisdictionCandidates.join(' / '))}</strong>`;

  const desc = String(report.description || '').trim();
  const descShown = desc.length > 1000 ? `${desc.slice(0, 1000)}…` : desc;
  const descHtml = descShown ? escapeHtml(descShown).replace(/\r?\n/g, '<br/>') : '<em>No description provided.</em>';

  const rows = [];
  rows.push(detailRow('Report ID', `<strong>#${escapeHtml(report.reportId)}</strong>`));
  if (report.category) rows.push(detailRow('Category', escapeHtml(report.category)));
  if (report.subCategory) rows.push(detailRow('Issue type', escapeHtml(report.subCategory)));
  if (report.areaType) rows.push(detailRow('Area type', escapeHtml(report.areaType)));
  if (report.addressInput) rows.push(detailRow('Address', escapeHtml(report.addressInput)));
  if (report.locationDescription) rows.push(detailRow('Location details', escapeHtml(report.locationDescription)));
  if (report.location) {
    const { lat, lng } = report.location;
    const maps = `https://www.google.com/maps?q=${lat},${lng}`;
    rows.push(detailRow('Map', `<a href="${maps}">Open in Google Maps</a> (${lat.toFixed(5)}, ${lng.toFixed(5)})`));
  }
  rows.push(detailRow('Submitted', escapeHtml(formatManila(report.createdAtMs))));
  rows.push(detailRow('Routing', routing));
  rows.push(
    detailRow('Photos', report.photoCount > 0
      ? `${report.photoCount} photo${report.photoCount === 1 ? '' : 's'} attached to the report`
      : 'No photos attached')
  );
  rows.push(detailRow('Description', descHtml));

  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:600px">' +
    '<p>A new report was submitted on CityEcoMap and needs your attention.</p>' +
    `<table style="border-collapse:collapse;width:100%;table-layout:fixed"><colgroup><col style="width:120px"/><col/></colgroup>${rows.join('')}</table>` +
    '<p style="margin:22px 0">' +
    `<a href="${link}" style="display:inline-block;padding:12px 22px;background:#2e7d32;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold">Open Report</a>` +
    '</p>' +
    '<p style="color:#555;font-size:12px">Sign in with your admin account if asked. You can only open reports that your role allows.</p>' +
    SIGNATURE +
    '</div>'
  );
}

// ---------- Middleware ----------
// Reject browsers that call us from an origin we do not know.
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  next();
});

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
);
app.use(express.json({ limit: '10kb' }));

const notifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const newReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// ---------- Routes ----------
// Authorized, server-built notification. The client sends only the report's Firestore
// document ID and the kind of update. The server decides who may send, and to whom.
app.post('/notify', notifyLimiter, async (req, res) => {
  try {
    const { reportDocId, kind } = req.body || {};
    if (typeof reportDocId !== 'string' || !DOC_ID_RE.test(reportDocId) ||
        typeof kind !== 'string' || !KIND_TO_STATUS[kind]) {
      return res.status(400).json({ error: 'Invalid request.' });
    }
    const match = /^Bearer (\S+)$/.exec(req.get('Authorization') || '');
    if (!match || match[1].length > 4096) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const idToken = match[1];

    const fail = (code) => {
      if (code === 'unauthenticated') return res.status(401).json({ error: 'Authentication required.' });
      if (code === 'forbidden') return res.status(403).json({ error: 'Not authorized for this report.' });
      return res.status(502).json({ error: 'Could not verify access.' });
    };

    const admin = await getAdminIdentity(idToken);
    if (admin.error) return fail(admin.error);

    const report = await loadReport(reportDocId);
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    const access = await verifyReportAccess(admin, report, reportDocId, idToken);
    if (access !== 'ok') return fail(access);

    // The email must match the report's current official status.
    if (!KIND_TO_STATUS[kind].includes(report.status)) {
      return res.status(409).json({ error: 'Report status does not match this notification.' });
    }
    if (!isValidEmail(report.email)) {
      return res.json({ success: true, skipped: 'no-valid-recipient' });
    }

    const dedupeKey = `${reportDocId}:${kind}`;
    if (wasSentRecently(dedupeKey)) return res.json({ success: true, skipped: 'duplicate' });
    if (!takeDailySlot()) return res.status(429).json({ error: 'Daily email limit reached.' });

    recentSends.set(dedupeKey, Date.now());
    const message = buildEmail(kind, report);
    const result = await sendViaBrevo(report.email, message.subject, message.html);
    if (!result.ok) {
      recentSends.delete(dedupeKey);
      releaseDailySlot();
      return res.status(502).json({ error: 'Failed to send email.' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Notify error:', err && err.name ? err.name : 'error');
    return res.status(500).json({ error: 'Failed to send email.' });
  }
});

// New-report notification to the responsible office admins. The citizen page sends only
// the report's Firestore document ID; the recipients, subject and body are decided here.
app.post('/notify-admins', newReportLimiter, async (req, res) => {
  try {
    const { reportDocId } = req.body || {};
    if (typeof reportDocId !== 'string' || !DOC_ID_RE.test(reportDocId)) {
      return res.status(400).json({ error: 'Invalid request.' });
    }
    const report = await loadNewReport(reportDocId);
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    // Always answers the same way, so a caller learns nothing about recipients or limits.
    const skip = (reason) => {
      console.log(`[notify-admins] skipped: ${reason}`);
      return res.json({ success: true, skipped: true });
    };

    if (report.status !== 'Pending') return skip('not-pending');
    if (report.createdAtMs === null) return skip('no-created-at');
    const age = Date.now() - report.createdAtMs;
    if (age > NEW_REPORT_WINDOW_MS || age < -60 * 1000) return skip('not-new');

    const seen = new Set();
    const recipients = [];
    for (const office of selectNotifyOffices(report)) {
      for (const email of getRecipients(office)) {
        const key = email.toLowerCase();
        if (!seen.has(key)) { seen.add(key); recipients.push(email); }
      }
    }
    if (recipients.length === 0) return skip('no-recipients');

    pruneAdminNotified();
    if (adminNotified.has(reportDocId)) return skip('duplicate');
    adminNotified.set(reportDocId, Date.now()); // reserved before any await

    const subject = buildNewReportSubject(report);
    const html = buildNewReportEmail(reportDocId, report);
    let sent = 0;
    for (const to of recipients) {
      if (!takeDailySlot()) { console.log('[notify-admins] daily cap reached'); break; }
      const token = takeHourlySlot();
      if (token === null) { releaseDailySlot(); console.log('[notify-admins] hourly cap reached'); break; }
      let ok = false;
      try {
        ok = (await sendViaBrevo(to, subject, html)).ok;
      } catch (e) {
        ok = false;
      }
      if (ok) sent += 1;
      else { releaseDailySlot(); releaseHourlySlot(token); }
    }
    if (sent === 0) {
      adminNotified.delete(reportDocId); // nothing went out, so a retry is still allowed
      return skip('no-email-sent');
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Notify-admins error:', err && err.name ? err.name : 'error');
    return res.status(500).json({ error: 'Failed to process request.' });
  }
});

// RETIRED: this endpoint used to send any recipient/subject/body without
// authentication. It is closed permanently; use POST /notify instead.
app.all('/send-email', (req, res) => {
  res.status(410).json({ error: 'This endpoint has been retired.' });
});

app.get('/', (req, res) => res.send('CityEcoMap Email Server running.'));

// Body-parser errors (too large / bad JSON)
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' });
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Invalid JSON.' });
  return next(err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Email server running on port ${PORT}`));