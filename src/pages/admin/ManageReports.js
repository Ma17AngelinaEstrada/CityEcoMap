import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import AdminLayout from "./AdminLayout";
import "./ManageReports.css";

export default function ManageReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedReport, setSelectedReport] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/admin");
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const snapshot = await getDocs(collection(db, "reports"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      data.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
      setReports(data);
    } catch (err) {
      console.error("Error fetching reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (reportId, newStatus) => {
    setUpdatingId(reportId);
    try {
      await updateDoc(doc(db, "reports", reportId), { status: newStatus });
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
      );
      if (selectedReport?.id === reportId) {
        setSelectedReport((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = reports.filter((r) => {
    const matchStatus = filterStatus === "All" || r.status === filterStatus;
    const matchCategory = filterCategory === "All" || r.category === filterCategory;
    return matchStatus && matchCategory;
  });

  const getStatusClass = (status) => {
    if (status === "Pending") return "mr-badge mr-badge--pending";
    if (status === "In Progress") return "mr-badge mr-badge--inprogress";
    if (status === "Resolved") return "mr-badge mr-badge--resolved";
    return "mr-badge";
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const date = ts.toDate?.();
    if (!date) return "—";
    return date.toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <AdminLayout>
      <div className="mr-header">
        <h2 className="mr-title">Manage & Resolve Reports</h2>
        <p className="mr-subtitle">View, update, and resolve citizen-submitted reports.</p>
      </div>

      {/* Filters */}
      <div className="mr-filters">
        <div className="mr-filter-group">
          <label>Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option>All</option>
            <option>Pending</option>
            <option>In Progress</option>
            <option>Resolved</option>
          </select>
        </div>
        <div className="mr-filter-group">
          <label>Category</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option>All</option>
            <option>Waste Issue</option>
            <option>Drainage Issue</option>
          </select>
        </div>
        <span className="mr-count">{filtered.length} report{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <p className="mr-loading">Loading reports...</p>
      ) : (
        <div className="mr-layout">
          {/* Table */}
          <div className="mr-table-card">
            <table className="mr-table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Type</th>
                  <th>Date Submitted</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="5" className="mr-empty">No reports found.</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={selectedReport?.id === r.id ? "mr-row--selected" : ""}
                      onClick={() => setSelectedReport(r)}
                    >
                      <td>#{r.reportId || r.id.slice(0, 6).toUpperCase()}</td>
                      <td>{r.category}</td>
                      <td>{formatDate(r.createdAt)}</td>
                      <td><span className={getStatusClass(r.status)}>{r.status || "Pending"}</span></td>
                      <td>
                        <button
                          className="mr-view-btn"
                          onClick={(e) => { e.stopPropagation(); setSelectedReport(r); }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          {selectedReport && (
            <div className="mr-detail">
              <div className="mr-detail-header">
                <h3>Report #{selectedReport.reportId || selectedReport.id.slice(0, 6).toUpperCase()}</h3>
                <button className="mr-close" onClick={() => setSelectedReport(null)}>✕</button>
              </div>

              <div className="mr-detail-body">
                <div className="mr-detail-row">
                  <span className="mr-detail-label">Type</span>
                  <span className="mr-detail-value">{selectedReport.category}</span>
                </div>
                <div className="mr-detail-row">
                  <span className="mr-detail-label">Date Submitted</span>
                  <span className="mr-detail-value">{formatDate(selectedReport.createdAt)}</span>
                </div>
                <div className="mr-detail-row">
                  <span className="mr-detail-label">Description</span>
                  <span className="mr-detail-value">{selectedReport.description || "—"}</span>
                </div>
                <div className="mr-detail-row">
                  <span className="mr-detail-label">Email</span>
                  <span className="mr-detail-value">{selectedReport.email || "Not provided"}</span>
                </div>
                <div className="mr-detail-row">
                  <span className="mr-detail-label">Location</span>
                  <span className="mr-detail-value">
                    {selectedReport.location
                      ? `${selectedReport.location.lat.toFixed(4)}° N, ${selectedReport.location.lng.toFixed(4)}° E`
                      : "—"}
                  </span>
                </div>

                {selectedReport.photo && (
                  <div className="mr-detail-photo">
                    <span className="mr-detail-label">Photo</span>
                    <img src={selectedReport.photo} alt="Report" className="mr-photo" />
                  </div>
                )}

                <div className="mr-detail-row">
                  <span className="mr-detail-label">Current Status</span>
                  <span className={getStatusClass(selectedReport.status)}>
                    {selectedReport.status || "Pending"}
                  </span>
                </div>

                <div className="mr-status-actions">
                  <p className="mr-detail-label">Update Status</p>
                  <div className="mr-status-btns">
                    {["Pending", "In Progress", "Resolved"].map((s) => (
                      <button
                        key={s}
                        className={`mr-status-btn mr-status-btn--${s.toLowerCase().replace(" ", "")} ${selectedReport.status === s ? "active" : ""}`}
                        onClick={() => handleStatusChange(selectedReport.id, s)}
                        disabled={updatingId === selectedReport.id}
                      >
                        {updatingId === selectedReport.id ? "Updating…" : s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}