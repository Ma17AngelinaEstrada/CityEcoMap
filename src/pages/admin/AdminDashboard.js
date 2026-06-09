import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";
import AdminLayout from "./AdminLayout";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/admin");
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const snapshot = await getDocs(collection(db, "reports"));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setReports(data);
      } catch (err) {
        console.error("Error fetching reports:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const total = reports.length;
  const resolved = reports.filter((r) => r.status === "Resolved").length;
  const pending = reports.filter((r) => r.status === "Pending").length;
  const inProgress = reports.filter((r) => r.status === "In Progress").length;

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const chartData = monthNames.map((month, i) => {
    const waste = reports.filter((r) => {
      const date = r.createdAt?.toDate?.();
      return date && date.getMonth() === i && r.category === "Waste Issue";
    }).length;
    const drainage = reports.filter((r) => {
      const date = r.createdAt?.toDate?.();
      return date && date.getMonth() === i && r.category === "Drainage Issue";
    }).length;
    return { month, "Waste Issues": waste, "Drainage Issues": drainage };
  });

  const recent = [...reports]
    .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
    .slice(0, 7);

  const getStatusClass = (status) => {
    if (status === "Pending") return "ad-badge ad-badge--pending";
    if (status === "In Progress") return "ad-badge ad-badge--inprogress";
    if (status === "Resolved") return "ad-badge ad-badge--resolved";
    return "ad-badge";
  };

  return (
    <AdminLayout>
      {loading ? (
        <p className="ad-loading">Loading reports...</p>
      ) : (
        <>
          <div className="ad-stats">
            <div className="ad-stat-card">
              <span className="ad-stat-label">Total Reports</span>
              <span className="ad-stat-number">{total}</span>
            </div>
            <div className="ad-stat-card">
              <span className="ad-stat-label">Resolved Reports</span>
              <span className="ad-stat-number">{resolved}</span>
            </div>
            <div className="ad-stat-card">
              <span className="ad-stat-label">Pending Reports</span>
              <span className="ad-stat-number">{pending}</span>
            </div>
            <div className="ad-stat-card">
              <span className="ad-stat-label">In Progress Reports</span>
              <span className="ad-stat-number">{inProgress}</span>
            </div>
          </div>

          <div className="ad-table-card">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan="4" className="ad-empty">No reports yet.</td></tr>
                ) : (
                  recent.map((r) => (
                    <tr key={r.id}>
                      <td>#{r.reportId || r.id.slice(0, 6).toUpperCase()}</td>
                      <td>{r.category}</td>
                      <td>—</td>
                      <td>
                        <span className={getStatusClass(r.status)}>
                          {r.status || "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="ad-bottom">
            <div className="ad-map-placeholder">
              <p className="ad-map-note">🗺 Map view coming soon</p>
            </div>
            <div className="ad-chart-card">
              <h3 className="ad-chart-title">Report Statistics</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Waste Issues" fill="#1a4a1a" radius={[3,3,0,0]} />
                  <Bar dataKey="Drainage Issues" fill="#7eb87e" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}