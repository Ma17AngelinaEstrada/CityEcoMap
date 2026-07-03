import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import AdminLayout from "./AdminLayout";
import "./ManageReports.css";
import { reverseGeocode } from '../../utils/geocode';

const sendEmailNotification = async (to, subject, body) => {
  if (!to) return;
  try {
    await fetch('http://localhost:5000/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body }),
    });
  } catch (err) {
    console.error('Email notification failed:', err);
  }
};

export default function ManageReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterAssigned, setFilterAssigned] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedReport, setSelectedReport] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [assignModal, setAssignModal] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [addresses, setAddresses] = useState({});

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
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
      setReports(data);
    } catch (err) {
      console.error("Error fetching reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const resolveAddresses = async () => {
      const newAddresses = {};
      for (const r of reports) {
        if (r.location?.lat && r.location?.lng) {
          const key = r.id;
          if (!addresses[key]) {
            const addr = await reverseGeocode(r.location.lat, r.location.lng);
            newAddresses[key] = addr;
            await new Promise((res) => setTimeout(res, 1100)); // respect 1 req/sec limit
          }
        }
      }
      if (Object.keys(newAddresses).length > 0) {
        setAddresses((prev) => ({ ...prev, ...newAddresses }));
      }
    };
    if (reports.length > 0) resolveAddresses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  const updateStatus = async (reportId, newStatus, extraFields = {}) => {
    setUpdatingId(reportId);
    try {
      await updateDoc(doc(db, "reports", reportId), {
        status: newStatus,
        ...extraFields,
      });
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, status: newStatus, ...extraFields } : r
        )
      );
      if (selectedReport?.id === reportId) {
        setSelectedReport((prev) => ({ ...prev, status: newStatus, ...extraFields }));
      }
    } catch (err) {
      alert("Failed to update. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Approve → open assign office modal
  const handleApprove = () => setAssignModal(true);

  const handleAssignOffice = async (office) => {
  setAssignModal(false);
  await updateStatus(selectedReport.id, "Approved", { assignedTo: office });
  await sendEmailNotification(
    selectedReport.email,
    "Your CityEcoMap Report Has Been Approved",
    `<p>Dear Citizen,</p>
     <p>Your report <strong>#${selectedReport.reportId}</strong> has been reviewed and approved.</p>
     <p>It has been assigned to <strong>${office}</strong> for action.</p>
     <p>Thank you for helping keep Lucena City clean!</p>
     <br/>
     <p>— CityEcoMap Team<br/>Environmental Management Bureau, Lucena City</p>`
  );
};

const handleRejectConfirm = async () => {
  if (!rejectReason.trim()) {
    alert("Please enter a reason for rejection.");
    return;
  }
  setRejectModal(false);
  await updateStatus(selectedReport.id, "Rejected", { rejectionReason: rejectReason });
  await sendEmailNotification(
    selectedReport.email,
    "Update on Your CityEcoMap Report",
    `<p>Dear Citizen,</p>
     <p>Your report <strong>#${selectedReport.reportId}</strong> has been reviewed but could not be approved.</p>
     <p><strong>Reason:</strong> ${rejectReason}</p>
     <p>If you believe this is an error, please submit a new report with clearer details.</p>
     <br/>
     <p>— CityEcoMap Team<br/>Environmental Management Bureau, Lucena City</p>`
  );
};

const handleRejectClick = () => {
  setRejectReason("");
  setRejectModal(true);
};

const handleSetOngoing = async () => {
  await updateStatus(selectedReport.id, "Ongoing");
  await sendEmailNotification(
    selectedReport.email,
    "Cleanup in Progress — CityEcoMap Report Update",
    `<p>Dear Citizen,</p>
     <p>Good news! Cleanup is now in progress for your report <strong>#${selectedReport.reportId}</strong>.</p>
     <p>Our team is actively working on resolving the issue. Thank you for your patience.</p>
     <br/>
     <p>— CityEcoMap Team<br/>Environmental Management Bureau, Lucena City</p>`
  );
};

const handleSetResolved = async () => {
  await updateStatus(selectedReport.id, "Resolved");
  await sendEmailNotification(
    selectedReport.email,
    "Your Report Has Been Resolved — CityEcoMap",
    `<p>Dear Citizen,</p>
     <p>Your report <strong>#${selectedReport.reportId}</strong> has been successfully resolved.</p>
     <p>Thank you for helping us build a cleaner, greener Lucena City!</p>
     <br/>
     <p>— CityEcoMap Team<br/>Environmental Management Bureau, Lucena City</p>`
  );
};

  const filtered = reports.filter((r) => {
  const matchStatus = filterStatus === "All" || r.status === filterStatus;
  const matchCategory = filterCategory === "All" || r.category === filterCategory;
  const matchAssigned = filterAssigned === "All" || r.assignedTo === filterAssigned;
  const cleanedSearch = searchQuery.replace(/#/g, "").trim().toLowerCase();
  const matchSearch = cleanedSearch === "" ||
      (r.reportId && r.reportId.toLowerCase().includes(cleanedSearch)) ||
      (r.description && r.description.toLowerCase().includes(cleanedSearch));
  
  let matchDate = true;
  if (dateFrom || dateTo) {
    const reportDate = r.createdAt?.toDate?.();
    if (reportDate) {
      if (dateFrom && reportDate < new Date(dateFrom)) matchDate = false;
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59);
        if (reportDate > toDate) matchDate = false;
      }
    }
  }

  return matchStatus && matchCategory && matchAssigned && matchSearch && matchDate;
});

  const getStatusClass = (status) => {
  if (status === "Pending") return "mr-badge mr-badge--pending";
  if (status === "Approved") return "mr-badge mr-badge--approved";
  if (status === "Ongoing" || status === "In Progress") return "mr-badge mr-badge--ongoing";
  if (status === "Resolved") return "mr-badge mr-badge--resolved";
  if (status === "Rejected") return "mr-badge mr-badge--rejected";
  return "mr-badge";
};

  const formatDate = (ts) => {
    if (!ts) return "—";
    const date = ts.toDate?.();
    if (!date) return "—";
    return date.toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  // Which action buttons to show based on current status
  const renderActions = () => {
    const s = selectedReport?.status;
    const busy = updatingId === selectedReport?.id;

    if (s === "Pending") return (
      <div className="mr-status-btns">
        <button className="mr-action-btn mr-action-btn--approve" onClick={handleApprove} disabled={busy}>
          ✔ Approve
        </button>
        <button className="mr-action-btn mr-action-btn--reject" onClick={handleRejectClick} disabled={busy}>
          ✕ Reject
        </button>
      </div>
    );

    if (s === "Approved") return (
      <div className="mr-status-btns">
        <button className="mr-action-btn mr-action-btn--ongoing" onClick={handleSetOngoing} disabled={busy}>
          ▶ Mark as Ongoing
        </button>
      </div>
    );

    if (s === "Ongoing" || s === "In Progress") return (
      <div className="mr-status-btns">
        <button className="mr-action-btn mr-action-btn--resolved" onClick={handleSetResolved} disabled={busy}>
          ✔ Mark as Resolved
        </button>
      </div>
    );

    if (s === "Resolved" || s === "Rejected") return (
      <p className="mr-no-action">No further actions available.</p>
    );
  };

  return (
    <AdminLayout>
      <div className="mr-header">
        <h2 className="mr-title">Manage & Resolve Reports</h2>
        <p className="mr-subtitle">Review, approve, reject, and resolve citizen-submitted reports.</p>
      </div>

      {/* Filters */}
      <div className="mr-filters">
  <div className="mr-filter-group">
    <label>Status</label>
    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
      <option>All</option>
      <option>Pending</option>
      <option>Approved</option>
      <option>Ongoing</option>
      <option>Resolved</option>
      <option>Rejected</option>
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
  <div className="mr-filter-group">
    <label>Assigned To</label>
    <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)}>
      <option>All</option>
      <option>EMB</option>
      <option>LGU</option>
    </select>
  </div>
  <div className="mr-filter-group">
    <label>Search</label>
    <input
      type="text"
      className="mr-search"
      placeholder="Report ID or keyword..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  </div>
  <div className="mr-filter-group">
  <label>From</label>
  <input
    type="date"
    className="mr-search"
    value={dateFrom}
    onChange={(e) => setDateFrom(e.target.value)}
  />
</div>
<div className="mr-filter-group">
  <label>To</label>
  <input
    type="date"
    className="mr-search"
    value={dateTo}
    onChange={(e) => setDateTo(e.target.value)}
  />
</div>
<button
  className="mr-clear-btn"
  onClick={() => {
    setFilterStatus("All");
    setFilterCategory("All");
    setFilterAssigned("All");
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
  }}
>
  Clear Filters
</button>
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
                  <th>Location</th>
                  <th>Assigned To</th>
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
                      <td>
                        {r.locationDescription && <div>{r.locationDescription}</div>}
                        {r.location && (
                          <div style={{ fontSize: '0.78rem', color: '#888' }}>
                            {addresses[r.id] || 'Resolving...'}
                          </div>
                        )}
                        {!r.locationDescription && !r.location && '—'}
                      </td>
                      <td>{r.assignedTo || "—"}</td>
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
                <h3>#{selectedReport.reportId || selectedReport.id.slice(0, 6).toUpperCase()}</h3>
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
                  <span className="mr-detail-label">Assigned To</span>
                  <span className="mr-detail-value">{selectedReport.assignedTo || "—"}</span>
                </div>
                <div className="mr-detail-row">
                  <span className="mr-detail-label">Location Description</span>
                  <span className="mr-detail-value">
                    {selectedReport.locationDescription || 'Not provided by citizen'}
                  </span>
                </div>
                <div className="mr-detail-row">
                  <span className="mr-detail-label">Detected Address</span>
                  <span className="mr-detail-value">
                    {selectedReport.location
                      ? (addresses[selectedReport.id] || 'Resolving...')
                      : '—'}
                  </span>
                </div>
                {selectedReport.status === "Rejected" && (
                  <div className="mr-detail-row">
                    <span className="mr-detail-label">Rejection Reason</span>
                    <span className="mr-detail-value mr-detail-value--rejected">
                      {selectedReport.rejectionReason || "—"}
                    </span>
                  </div>
                )}
                {selectedReport.photo && (
                  <div className="mr-detail-photo">
                    <span className="mr-detail-label">Photo</span>
                    <img
                      src={selectedReport.photo}
                      alt="Report"
                      className="mr-photo"
                      onClick={() => setLightboxPhoto(selectedReport.photo)}
                    />
                    <span className="mr-photo-hint">Click photo to enlarge</span>
                  </div>
                )}
                <div className="mr-detail-row">
                  <span className="mr-detail-label">Current Status</span>
                  <span className={getStatusClass(selectedReport.status)}>
                    {selectedReport.status || "Pending"}
                  </span>
                </div>
                <div className="mr-status-actions">
                  <p className="mr-detail-label">Actions</p>
                  {renderActions()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assign Office Modal */}
      {assignModal && (
        <div className="mr-modal-overlay">
          <div className="mr-modal">
            <h3>Select Office to Assign</h3>
            <p>Assign this report to the appropriate office for action.</p>
            <div className="mr-modal-btns">
              <button className="mr-modal-btn mr-modal-btn--emb" onClick={() => handleAssignOffice("EMB")}>
                EMB
              </button>
              <button className="mr-modal-btn mr-modal-btn--lgu" onClick={() => handleAssignOffice("LGU")}>
                LGU
              </button>
            </div>
            <button className="mr-modal-cancel" onClick={() => setAssignModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="mr-modal-overlay">
          <div className="mr-modal">
            <h3>Reason for Rejection</h3>
            <p>Please provide a reason why this report is being rejected.</p>
            <textarea
              className="mr-reject-textarea"
              placeholder="Enter reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
            <div className="mr-modal-btns">
              <button className="mr-modal-btn mr-modal-btn--emb" onClick={handleRejectConfirm}>
                Confirm Reject
              </button>
              <button className="mr-modal-cancel" onClick={() => setRejectModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {lightboxPhoto && (
        <div className="mr-lightbox-overlay" onClick={() => setLightboxPhoto(null)}>
          <div className="mr-lightbox">
            <button className="mr-lightbox-close" onClick={() => setLightboxPhoto(null)}>✕</button>
            <img src={lightboxPhoto} alt="Report enlarged" className="mr-lightbox-img" />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}