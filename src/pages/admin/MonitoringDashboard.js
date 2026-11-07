
import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase/firebase';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import AdminLayout from './AdminLayout';
import './MonitoringDashboard.css';

const STATUS_LABELS = ['Pending', 'Approved', 'Ongoing', 'Resolved', 'Rejected'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STAT_STATUSES = ['Pending', 'Approved', 'Ongoing', 'Resolved', 'Rejected'];
const STAT_STATUS_COLORS = {
  Pending: '#e53935',
  Approved: '#1565c0',
  Ongoing: '#f9a825',
  Resolved: '#2e7d32',
  Rejected: '#757575',
};
const STAT_CATEGORIES = ['Waste Issue', 'Drainage Issue'];
const STAT_CATEGORY_COLORS = { 'Waste Issue': '#2e7d32', 'Drainage Issue': '#1565c0' };
const STAT_SUBS = {
  'Waste Issue': [
    'Illegal Dumping',
    'Uncollected Garbage',
    'Waste Affecting Rivers, Waterways, and Natural Water Bodies',
    'Other',
  ],
  'Drainage Issue': ['Clogged Drainage', 'Blocked Drainage', 'Damaged Drainage', 'Flooding', 'Other'],
};
const STAT_SUB_COLORS = {
  'Waste Issue': ['#2e7d32', '#66a06a', '#a5d6a7', '#8d8f6b'],
  'Drainage Issue': ['#1565c0', '#5e92d9', '#b3cde8', '#8a97a8', '#3f6fa8'],
};

const shortLabel = (label) =>
  label === 'Waste Affecting Rivers, Waterways, and Natural Water Bodies' ? 'Rivers/Waterways' : label;

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function getStatBuckets(range) {
  const now = new Date();
  const year = now.getFullYear();
  const make = (label, start, end) => ({ label, start: ymd(start), end: ymd(end) });

  if (range === 'year') {
    return MONTH_NAMES.map((label, m) => make(label, new Date(year, m, 1), new Date(year, m + 1, 1)));
  }

  if (range === 'month') {
    const monthStart = new Date(year, now.getMonth(), 1);
    const monthEnd = new Date(year, now.getMonth() + 1, 1);
    const out = [];
    let wStart = new Date(monthStart);
    let week = 1;
    while (wStart < monthEnd) {
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 7);
      const clamped = wEnd > monthEnd ? monthEnd : wEnd;
      out.push(make(`Wk ${week}`, wStart, clamped));
      wStart = clamped;
      week += 1;
    }
    return out;
  }

  if (range === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return [0, 1, 2].map((i) => {
      const m = q * 3 + i;
      return make(MONTH_NAMES[m], new Date(year, m, 1), new Date(year, m + 1, 1));
    });
  }

  if (range === 'last3') {
    return [2, 1, 0].map((i) => {
      const d = new Date(year, now.getMonth() - i, 1);
      return make(MONTH_NAMES[d.getMonth()], d, new Date(d.getFullYear(), d.getMonth() + 1, 1));
    });
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 27);
  return [0, 1, 2, 3].map((i) => {
    const wStart = new Date(start);
    wStart.setDate(start.getDate() + i * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 7);
    return make(`Wk ${i + 1}`, wStart, wEnd);
  });
}

function getStatRangeLabel(range) {
  const now = new Date();
  return {
    month: `This Month (${MONTH_NAMES[now.getMonth()]})`,
    quarter: 'This Quarter',
    last3: 'Last 3 Months',
    last1: 'Last 4 Weeks',
    year: `This Year (${now.getFullYear()})`,
  }[range];
}

// Read-only statistics built from the aggregate breakdown rows
// ({ d: day, c: category, s: subcategory, st: status, n: count }).
function MonitoringStatistics({ breakdown }) {
  const [range, setRange] = useState('year');
  const [view, setView] = useState('category');
  const [parentCategory, setParentCategory] = useState('Waste Issue');

  const hasData = Array.isArray(breakdown);
  const rows = useMemo(() => (hasData ? breakdown : []), [hasData, breakdown]);
  const buckets = useMemo(() => getStatBuckets(range), [range]);

  if (!hasData) {
    return (
      <section className="monitoring-panel monitoring-stats">
        <h2>Report Statistics</h2>
        <p className="monitoring-message">
          Detailed statistics will appear after the next statistics update. This
          happens automatically when a Master Admin next opens the system.
        </p>
      </section>
    );
  }

  const rangeStart = buckets[0].start;
  const rangeEnd = buckets[buckets.length - 1].end;
  const total = (list) => list.reduce((sum, r) => sum + (Number(r.n) || 0), 0);
  const rangeRows = rows.filter((r) => r.d >= rangeStart && r.d < rangeEnd);
  const activeSubs = STAT_SUBS[parentCategory];
  const subColors = STAT_SUB_COLORS[parentCategory];

  const categoryData = buckets.map((b) => {
    const inB = rows.filter((r) => r.d >= b.start && r.d < b.end);
    return {
      label: b.label,
      'Waste Issues': total(inB.filter((r) => r.c === 'Waste Issue')),
      'Drainage Issues': total(inB.filter((r) => r.c === 'Drainage Issue')),
    };
  });

  const subData = buckets.map((b) => {
    const inB = rows.filter((r) => r.d >= b.start && r.d < b.end && r.c === parentCategory);
    const row = { label: b.label };
    activeSubs.forEach((s) => {
      row[s] = total(inB.filter((r) => r.s === s));
    });
    return row;
  });

  const statusData = STAT_CATEGORIES.map((cat) => {
    const row = { label: cat === 'Waste Issue' ? 'Waste Issues' : 'Drainage Issues' };
    STAT_STATUSES.forEach((st) => {
      row[st] = total(rangeRows.filter((r) => r.c === cat && r.st === st));
    });
    return row;
  });

  let pieData;
  let pieColors;
  if (view === 'category') {
    pieData = STAT_CATEGORIES.map((c) => ({ name: c, value: total(rangeRows.filter((r) => r.c === c)) }));
    pieColors = STAT_CATEGORIES.map((c) => STAT_CATEGORY_COLORS[c]);
  } else if (view === 'status') {
    pieData = STAT_STATUSES.map((st) => ({ name: st, value: total(rangeRows.filter((r) => r.st === st)) }));
    pieColors = STAT_STATUSES.map((st) => STAT_STATUS_COLORS[st]);
  } else {
    pieData = activeSubs.map((s) => ({
      name: shortLabel(s),
      value: total(rangeRows.filter((r) => r.c === parentCategory && r.s === s)),
    }));
    pieColors = subColors;
  }
  const pieTotal = pieData.reduce((sum, d) => sum + d.value, 0);

  const topSubs = [];
  STAT_CATEGORIES.forEach((cat) => {
    STAT_SUBS[cat].forEach((s) => {
      const count = total(rangeRows.filter((r) => r.c === cat && r.s === s));
      if (count > 0) {
        topSubs.push({
          name: s === 'Other' ? `Other (${cat === 'Waste Issue' ? 'Waste' : 'Drainage'})` : shortLabel(s),
          count,
          category: cat,
        });
      }
    });
  });
  topSubs.sort((a, b) => b.count - a.count);

  const axisTick = { fontSize: 11 };
  const tooltipStyle = { maxWidth: 200, fontSize: '0.78rem' };
  const rangeLabel = getStatRangeLabel(range);

  return (
    <section className="monitoring-panel monitoring-stats">
      <div className="monitoring-stats-header">
        <h2>Report Statistics — {rangeLabel}</h2>
        <div className="monitoring-stats-filters">
          <label className="monitoring-stats-filter">
            Time Range
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="month">This Month</option>
              <option value="last1">Last 4 Weeks</option>
              <option value="last3">Last 3 Months</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </label>
          <label className="monitoring-stats-filter">
            View
            <select value={view} onChange={(e) => setView(e.target.value)}>
              <option value="category">By Category</option>
              <option value="subcategory">By Sub-Category</option>
              <option value="status">By Status</option>
            </select>
          </label>
          {view === 'subcategory' && (
            <label className="monitoring-stats-filter">
              Category
              <select value={parentCategory} onChange={(e) => setParentCategory(e.target.value)}>
                <option value="Waste Issue">Waste Issue</option>
                <option value="Drainage Issue">Drainage Issue</option>
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="monitoring-stats-body">
        <div className="monitoring-stats-main">
          <div className="monitoring-stats-bar">
            <ResponsiveContainer width="100%" height={240}>
              {view === 'category' ? (
                <BarChart data={categoryData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} />
                  <YAxis tick={axisTick} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Waste Issues" fill={STAT_CATEGORY_COLORS['Waste Issue']} stackId="a" />
                  <Bar dataKey="Drainage Issues" fill={STAT_CATEGORY_COLORS['Drainage Issue']} radius={[3, 3, 0, 0]} stackId="a" />
                </BarChart>
              ) : view === 'subcategory' ? (
                <BarChart data={subData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} />
                  <YAxis tick={axisTick} allowDecimals={false} />
                  <Tooltip formatter={(value, name) => [value, shortLabel(name)]} contentStyle={tooltipStyle} />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} formatter={(value) => shortLabel(value)} />
                  {activeSubs.map((s, i) => (
                    <Bar
                      key={s}
                      dataKey={s}
                      fill={subColors[i % subColors.length]}
                      radius={i === activeSubs.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      stackId="b"
                    />
                  ))}
                </BarChart>
              ) : (
                <BarChart data={statusData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} />
                  <YAxis tick={axisTick} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                  {STAT_STATUSES.map((st, i) => (
                    <Bar
                      key={st}
                      dataKey={st}
                      fill={STAT_STATUS_COLORS[st]}
                      radius={i === STAT_STATUSES.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      stackId="c"
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="monitoring-stats-donut">
            {pieTotal === 0 ? (
              <p className="monitoring-stats-empty">No reports in this range yet.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {pieData.map((entry, i) => (
                        <Cell key={entry.name} fill={pieColors[i % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="monitoring-stats-legend">
                  {pieData.map((d, i) =>
                    d.value > 0 ? (
                      <div key={d.name} className="monitoring-stats-legend-item">
                        <span className="monitoring-stats-dot" style={{ background: pieColors[i % pieColors.length] }} />
                        <span>{d.name}</span>
                        <span className="monitoring-stats-pct">{Math.round((d.value / pieTotal) * 100)}%</span>
                      </div>
                    ) : null
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="monitoring-stats-top">
          <h3>Top Subcategories — {rangeLabel}</h3>
          {topSubs.length === 0 ? (
            <p className="monitoring-stats-empty">No reports in this range yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, topSubs.length * 34)}>
              <BarChart data={topSubs} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={axisTick} />
                <YAxis type="category" dataKey="name" tick={axisTick} width={130} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Reports" radius={[0, 4, 4, 0]} barSize={18}>
                  {topSubs.map((entry) => (
                    <Cell key={entry.name} fill={STAT_CATEGORY_COLORS[entry.category] || '#aaaaaa'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

function MonitoringContent() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    return onSnapshot(
      doc(db, 'monitoringStats', 'current'),
      (snapshot) => {
        setStats(snapshot.exists() ? snapshot.data() : null);
        setError('');
        setLoading(false);
      },
      (err) => {
        console.error('Monitoring statistics read failed:', err);
        setError(
          'Monitoring statistics are not available yet. The authorized statistics process must create the aggregate summary first.'
        );
        setLoading(false);
      }
    );
  }, []);

  const statusCounts = stats?.statusCounts || {};
  const trend = Array.isArray(stats?.dailyTrend) ? stats.dailyTrend : [];
  const updatedAt = stats?.updatedAt?.toDate?.();

  return (
    <main className="monitoring-page">
      <header className="monitoring-header">
        <div>
          <p className="monitoring-eyebrow">CITYECOMAP · LUCENA CITY</p>
          <h1>Environmental Monitoring</h1>
          <p>System-wide summary of environmental reports</p>
        </div>
        <span className="monitoring-readonly">Read-only access</span>
      </header>

      {loading ? (
        <p className="monitoring-message">Loading aggregate statistics…</p>
      ) : error ? (
        <div className="monitoring-message monitoring-warning">{error}</div>
      ) : !stats ? (
        <div className="monitoring-message monitoring-warning">
          Monitoring statistics are not available yet. The authorized statistics process must create the aggregate summary first.
        </div>
      ) : (
        <>
          <section className="monitoring-cards" aria-label="Report summary">
            <article className="monitoring-card">
              <span>Total reports</span>
              <strong>{Number(stats.totalReports || 0).toLocaleString()}</strong>
            </article>

            {STATUS_LABELS.map((status) => (
              <article className="monitoring-card" key={status}>
                <span>{status}</span>
                <strong>
                  {Number(statusCounts[status] || 0).toLocaleString()}
                </strong>
              </article>
            ))}
          </section>

          <MonitoringStatistics breakdown={stats.breakdown} />

          <section className="monitoring-panel">
            <h2>Report trend</h2>
            {trend.length ? (
              <div className="monitoring-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="total"
                      name="Reports"
                      fill="#2f855a"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="monitoring-message">
                Trend data is not available yet.
              </p>
            )}
          </section>

          <p className="monitoring-updated">
            Last updated:{' '}
            {updatedAt ? updatedAt.toLocaleString('en-PH') : 'Not provided'}
          </p>
        </>
      )}

      <p className="monitoring-privacy">
        This dashboard displays aggregate statistics only. Individual reports
        and citizens’ personal information are not shown.
      </p>
    </main>
  );
}

export default function MonitoringDashboard() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCheckingRole(true);

      if (!user) {
        navigate('/admin', { replace: true });
        setRole(null);
        setCheckingRole(false);
        return;
      }

      try {
        const { getDocFromServer } = await import('firebase/firestore');
        const snapshot = await getDocFromServer(
          doc(db, 'admins', user.uid)
        );

        if (!snapshot.exists() || snapshot.data().status !== 'Active') {
          await signOut(auth);
          navigate('/admin', { replace: true });
          setRole(null);
          return;
        }

        const currentRole = snapshot.data().role;

        if (!['Master Admin', 'EMB Admin'].includes(currentRole)) {
          navigate('/admin/dashboard', { replace: true });
          setRole(null);
          return;
        }

        setRole(currentRole);
      } catch (err) {
        console.error('Unable to verify monitoring access:', err);
        setRole(null);
      } finally {
        setCheckingRole(false);
      }
    });

    return unsubscribe;
  }, [navigate]);

  if (checkingRole || !role) {
    return (
      <main className="monitoring-page">
        <p className="monitoring-message">
          {checkingRole ? 'Verifying access…' : 'Unable to verify monitoring access. Please sign in again.'}
        </p>
        {!checkingRole && (
          <button
            className="monitoring-logout"
            onClick={() => navigate('/admin', { replace: true })}
          >
            Back to login
          </button>
        )}
      </main>
    );
  }

    return (
    <AdminLayout>
      <div className="monitoring-page-wrapper">
        <MonitoringContent />
      </div>
    </AdminLayout>
  );
}
