
import { useEffect, useState } from 'react';
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
} from 'recharts';
import AdminLayout from './AdminLayout';
import './MonitoringDashboard.css';

const STATUS_LABELS = ['Pending', 'Approved', 'Ongoing', 'Resolved'];

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
