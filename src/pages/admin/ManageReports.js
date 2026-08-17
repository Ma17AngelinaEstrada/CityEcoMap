import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import AdminLayout from "./AdminLayout";
import "./ManageReports.css";
import { reverseGeocode, isCached } from '../../utils/geocode';

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

const RIVER_SUBCATEGORY = "Waste Affecting Rivers, Waterways, and Natural Water Bodies";

const getSuggestedAssignee = (subCategory) => {
  if (subCategory === RIVER_SUBCATEGORY) return "EMB";
  return "LGU";
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
  const [rejectConfirming, setRejectConfirming] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [pendingOffice, setPendingOffice] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [addresses, setAddresses] = useState({});
  const [statusHistory, setStatusHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toast, setToast] = useState(null);
  const isFirstLoad = useRef(true);
  const prevIdsRef = useRef(new Set());
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterSubCategory, setFilterSubCategory] = useState("All");
  const [quickRange, setQuickRange] = useState("custom");
  const [specificMonth, setSpecificMonth] = useState("");

  const WASTE_SUBCATEGORIES = ["Illegal Dumping", "Uncollected Garbage", "Waste Affecting Rivers, Waterways, and Natural Water Bodies", "Other"];
  const DRAINAGE_SUBCATEGORIES = ["Blocked Drainage", "Damaged Drainage", "Flooding", "Other"];
  const KNOWN_SUBCATEGORIES = new Set([
    ...WASTE_SUBCATEGORIES.filter((s) => s !== "Other"),
    ...DRAINAGE_SUBCATEGORIES.filter((s) => s !== "Other"),
  ]);
  const isOtherSubCategory = (subCategory) =>
    Boolean(subCategory) && !KNOWN_SUBCATEGORIES.has(subCategory);

  const applyQuickRange = (value) => {
    setQuickRange(value);
    const today = new Date();

    if (value === "all") {
      setDateFrom("");
      setDateTo("");
      setSpecificMonth("");
      return;
    }
    if (value === "last1") {
      const from = new Date(today);
      from.setMonth(from.getMonth() - 1);
      setDateFrom(from.toISOString().slice(0, 10));
      setDateTo(today.toISOString().slice(0, 10));
      setSpecificMonth("");
      return;
    }
    if (value === "last3") {
      const from = new Date(today);
      from.setMonth(from.getMonth() - 3);
      setDateFrom(from.toISOString().slice(0, 10));
      setDateTo(today.toISOString().slice(0, 10));
      setSpecificMonth("");
      return;
    }
    if (value === "quarter") {
      const q = Math.floor(today.getMonth() / 3);
      const from = new Date(today.getFullYear(), q * 3, 1);
      const to = new Date(today.getFullYear(), q * 3 + 3, 0);
      setDateFrom(from.toISOString().slice(0, 10));
      setDateTo(to.toISOString().slice(0, 10));
      setSpecificMonth("");
      return;
    }
    if (value === "month") {
      setDateFrom("");
      setDateTo("");
    }
  };

  const applySpecificMonth = (monthValue) => {
    setSpecificMonth(monthValue);
    if (!monthValue) return;
    const [year, month] = monthValue.split("-").map(Number);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0);
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(to.toISOString().slice(0, 10));
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/admin");
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reports"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

      if (!isFirstLoad.current) {
        const newOnes = data.filter(
          (r) => !prevIdsRef.current.has(r.id) && r.status === "Pending"
        );
        if (newOnes.length > 0) {
          setToast(`🔔 ${newOnes.length} new report${newOnes.length > 1 ? "s" : ""} received`);
          setTimeout(() => setToast(null), 5000);
        }
      }

      prevIdsRef.current = new Set(data.map((r) => r.id));
      isFirstLoad.current = false;
      setReports(data);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching reports:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    console.log("location.state:", location.state);
    const targetId = location.state?.openReportId;
    console.log("targetId:", targetId);
    console.log("reports.length:", reports.length);
    if (targetId && reports.length > 0) {
      const target = reports.find((r) => r.id === targetId);
      console.log("target found:", target);
      if (target) {
        setSelectedReport(target);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, reports]);

  useEffect(() => {
    const targetId = searchParams.get("report");
    const statusParam = searchParams.get("status");

    if (statusParam) {
      setFilterStatus(statusParam);
    }

    if (targetId && reports.length > 0) {
      const target = reports.find((r) => r.id === targetId);
      if (target) {
        setSelectedReport(target);
      }
    }

    if (targetId || statusParam) {
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, reports]);

  useEffect(() => {
    const resolveAddresses = async () => {
      const newAddresses = {};
      for (const r of reports) {
        if (r.location?.lat && r.location?.lng) {
          const key = r.id;
          if (!addresses[key]) {
            const wasCached = isCached(r.location.lat, r.location.lng);
            const addr = await reverseGeocode(r.location.lat, r.location.lng);
            newAddresses[key] = addr;
            if (!wasCached) {
              await new Promise((res) => setTimeout(res, 1100)); // only throttle real API calls
            }
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

        await addDoc(collection(db, "reports", reportId, "statusHistory"), {
          status: newStatus,
          timestamp: serverTimestamp(),
          adminEmail: auth.currentUser?.email || "unknown",
          notes: extraFields.rejectionReason || extraFields.assignedTo
            ? `Assigned to ${extraFields.assignedTo || "N/A"}${extraFields.rejectionReason ? `, Reason: ${extraFields.rejectionReason}` : ""}`
            : null,
        });

        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId ? { ...r, status: newStatus, ...extraFields } : r
          )
        );
        if (selectedReport?.id === reportId) {
          setSelectedReport((prev) => ({ ...prev, status: newStatus, ...extraFields }));
          fetchStatusHistory(reportId);
        }
      } catch (err) {
        alert("Failed to update. Please try again.");
      } finally {
        setUpdatingId(null);
      }
    };

  // Approve → open assign office modal
  const handleApprove = () => {
    setPendingOffice(null);
    setAssignModal(true);
  };

  const handleAssignOffice = async (office) => {
  setAssignModal(false);
  setPendingOffice(null);
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

const handleSelectOffice = (office) => {
  setPendingOffice(office);
};

const handleConfirmAssign = async () => {
  const office = pendingOffice;
  await handleAssignOffice(office);
};

const handleCancelAssign = () => {
  setAssignModal(false);
  setPendingOffice(null);
};

const handleRejectReasonNext = () => {
  if (!rejectReason.trim()) {
    alert("Please enter a reason for rejection.");
    return;
  }
  setRejectConfirming(true);
};

const handleRejectConfirm = async () => {
  setRejectModal(false);
  setRejectConfirming(false);
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
  setRejectConfirming(false);
  setRejectModal(true);
};

const handleRejectCancel = () => {
  setRejectModal(false);
  setRejectConfirming(false);
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

  const fetchStatusHistory = async (reportId) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "reports", reportId, "statusHistory"),
        orderBy("timestamp", "asc")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStatusHistory(data);
    } catch (err) {
      console.error("Error fetching status history:", err);
      setStatusHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedReport?.id) {
      fetchStatusHistory(selectedReport.id);
    } else {
      setStatusHistory([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport?.id]);

  const filtered = reports.filter((r) => {
  const matchStatus = filterStatus === "All" || r.status === filterStatus;
  const matchCategory = filterCategory === "All" || r.category === filterCategory;
  const matchSubCategory = (() => {
    if (filterSubCategory === "All") return true;
    if (filterSubCategory === "Other::Waste") return r.category === "Waste Issue" && isOtherSubCategory(r.subCategory);
    if (filterSubCategory === "Other::Drainage") return r.category === "Drainage Issue" && isOtherSubCategory(r.subCategory);
    return r.subCategory === filterSubCategory;
  })();
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

  return matchStatus && matchCategory && matchSubCategory && matchAssigned && matchSearch && matchDate;
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
      {toast && (
        <div className="mr-toast">
          {toast}
        </div>
      )}
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
            <label>Sub-Category</label>
            <select
              className="mr-subcat-select"
              value={filterSubCategory}
              onChange={(e) => {
                const raw = e.target.value;
                setFilterSubCategory(raw);
                if (raw === "All") return;
                if (raw === "Other::Waste") { setFilterCategory("Waste Issue"); return; }
                if (raw === "Other::Drainage") { setFilterCategory("Drainage Issue"); return; }
                if (WASTE_SUBCATEGORIES.includes(raw)) setFilterCategory("Waste Issue");
                else if (DRAINAGE_SUBCATEGORIES.includes(raw)) setFilterCategory("Drainage Issue");
              }}
            >
              <option value="All">All</option>
              <optgroup label="Waste Issue">
                {WASTE_SUBCATEGORIES.map((s) =>
                  s === "Other"
                    ? <option key="w-other" value="Other::Waste">Other</option>
                    : <option key={s} value={s}>{s}</option>
                )}
              </optgroup>
              <optgroup label="Drainage Issue">
                {DRAINAGE_SUBCATEGORIES.map((s) =>
                  s === "Other"
                    ? <option key="d-other" value="Other::Drainage">Other</option>
                    : <option key={`d-${s}`} value={s}>{s}</option>
                )}
              </optgroup>
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
          <div className="mr-filters-tail">
            <div className="mr-filter-group">
              <label>Time Range</label>
              <select value={quickRange} onChange={(e) => applyQuickRange(e.target.value)}>
                <option value="custom">Custom Range</option>
                <option value="all">All Time</option>
                <option value="last1">Last 1 Month</option>
                <option value="last3">Last 3 Months</option>
                <option value="quarter">This Quarter</option>
                <option value="month">Specific Month</option>
              </select>
            </div>
            {quickRange === "month" && (
              <div className="mr-filter-group">
                <label>Month</label>
                <input type="month" className="mr-search" value={specificMonth} onChange={(e) => applySpecificMonth(e.target.value)} />
              </div>
            )}
            <div className="mr-daterange-group">
              <div className="mr-filter-group">
                <label>From</label>
                <input
                  type="date"
                  className="mr-search"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setQuickRange("custom"); }}
                />
              </div>
              <div className="mr-filter-group">
                <label>To</label>
                <input
                  type="date"
                  className="mr-search"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setQuickRange("custom"); }}
                />
              </div>
            </div>
            <button
              className="mr-clear-btn"
              onClick={() => {
                setFilterStatus("All");
                setFilterCategory("All");
                setFilterSubCategory("All");
                setFilterAssigned("All");
                setSearchQuery("");
                setDateFrom("");
                setDateTo("");
                setQuickRange("custom");
                setSpecificMonth("");
              }}
            >
              Clear Filters
            </button>
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
              <colgroup>
                <col style={{ width: "8%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "7%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Submitted By</th>
                  <th>Email</th>
                  <th>Category</th>
                  <th>Sub-Category</th>
                  <th>Date Submitted</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="11" className="mr-empty">No reports found.</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={selectedReport?.id === r.id ? "mr-row--selected" : ""}
                      onClick={() => setSelectedReport(r)}
                    >
                      <td>#{r.reportId || r.id.slice(0, 6).toUpperCase()}</td>
                      <td>{r.fullName || "—"}</td>
                      <td>{r.email || "—"}</td>
                      <td>{r.category}</td>
                      <td>
                        {r.subCategory === "Other"
                          ? (r.subCategoryOther || "Other")
                          : (r.subCategory || "—")}
                      </td>
                      <td>{formatDate(r.createdAt)}</td>
                      <td>{r.description || "—"}</td>
                      <td>
                        {r.locationDescription && <div>{r.locationDescription}</div>}
                        {r.addressInput ? (
                          <div style={{ fontSize: '0.78rem', color: '#888' }}>{r.addressInput}</div>
                        ) : r.location ? (
                          <div style={{ fontSize: '0.78rem', color: '#888' }}>
                            {addresses[r.id] || 'Resolving...'}
                          </div>
                        ) : null}
                        {!r.locationDescription && !r.addressInput && !r.location && '—'}
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
        </div>
      )}

      {/* Detail modal — centered popup, same pattern as Assign Office */}
      {selectedReport && (
        <div className="mr-modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="mr-detail mr-detail--modal" onClick={(e) => e.stopPropagation()}>
            <div className="mr-detail-header">
              <h3>#{selectedReport.reportId || selectedReport.id.slice(0, 6).toUpperCase()}</h3>
              <button className="mr-close" onClick={() => setSelectedReport(null)}>✕</button>
            </div>
            <div className="mr-detail-body">
              <div className="mr-detail-row">
                <span className="mr-detail-label">Submitted By</span>
                <span className="mr-detail-value">{selectedReport.fullName || "—"}</span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Email</span>
                <span className="mr-detail-value">{selectedReport.email || "Not provided"}</span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Category</span>
                <span className="mr-detail-value">{selectedReport.category}</span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Sub-Category</span>
                <span className="mr-detail-value">
                  {selectedReport.subCategory === "Other"
                    ? (selectedReport.subCategoryOther || "Other")
                    : (selectedReport.subCategory || "—")}
                </span>
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
                <span className="mr-detail-label">Location Description</span>
                <span className="mr-detail-value">
                  {selectedReport.locationDescription || 'Not provided by citizen'}
                </span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Address</span>
                <span className="mr-detail-value">
                  {selectedReport.addressInput
                    ? selectedReport.addressInput
                    : selectedReport.location
                      ? (addresses[selectedReport.id] || 'Resolving...')
                      : '—'}
                </span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Assigned To</span>
                <span className="mr-detail-value">{selectedReport.assignedTo || "—"}</span>
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

              <div className="mr-history-section">
                <p className="mr-detail-label">Status History</p>
                {loadingHistory ? (
                  <p className="mr-history-loading">Loading history...</p>
                ) : statusHistory.length === 0 ? (
                  <p className="mr-history-empty">No history recorded yet.</p>
                ) : (
                  <div className="mr-history-list">
                    {statusHistory.map((h) => (
                      <div key={h.id} className="mr-history-item">
                        <span className={getStatusClass(h.status)}>{h.status}</span>
                        <span className="mr-history-admin">{h.adminEmail}</span>
                        <span className="mr-history-date">{formatDate(h.timestamp)}</span>
                        {h.notes && <p className="mr-history-notes">{h.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Office Modal */}
      {assignModal && (
        <div className="mr-modal-overlay">
          <div className="mr-modal">
            {!pendingOffice ? (
              <>
                <h3>Select Office to Assign</h3>
                <p>Assign this report to the appropriate office for action.</p>
                <p className="mr-modal-suggestion">
                  Suggested: <strong>{getSuggestedAssignee(selectedReport?.subCategory)}</strong>
                  {" "}(based on sub-category — you may still choose either office)
                </p>
                <div className="mr-modal-btns">
                  <button
                    className={`mr-modal-btn mr-modal-btn--emb${getSuggestedAssignee(selectedReport?.subCategory) === "EMB" ? " mr-modal-btn--suggested" : ""}`}
                    onClick={() => handleSelectOffice("EMB")}
                  >
                    EMB{getSuggestedAssignee(selectedReport?.subCategory) === "EMB" ? " ✓ Suggested" : ""}
                  </button>
                  <button
                    className={`mr-modal-btn mr-modal-btn--lgu${getSuggestedAssignee(selectedReport?.subCategory) === "LGU" ? " mr-modal-btn--suggested" : ""}`}
                    onClick={() => handleSelectOffice("LGU")}
                  >
                    LGU{getSuggestedAssignee(selectedReport?.subCategory) === "LGU" ? " ✓ Suggested" : ""}
                  </button>
                </div>
                <button className="mr-modal-cancel" onClick={handleCancelAssign}>Cancel</button>
              </>
            ) : (
              <>
                <h3>Confirm Assignment</h3>
                <p>
                  Assign report <strong>#{selectedReport?.reportId || selectedReport?.id?.slice(0, 6).toUpperCase()}</strong> to <strong>{pendingOffice}</strong>?
                </p>
                <div className="mr-modal-btns">
                  <button className="mr-modal-btn mr-modal-btn--emb" onClick={handleConfirmAssign}>
                    ✔ Confirm
                  </button>
                </div>
                <button className="mr-modal-cancel" onClick={() => setPendingOffice(null)}>← Back</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="mr-modal-overlay">
          <div className="mr-modal">
            {!rejectConfirming ? (
              <>
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
                  <button className="mr-modal-btn mr-modal-btn--emb" onClick={handleRejectReasonNext}>
                    Next
                  </button>
                  <button className="mr-modal-cancel" onClick={handleRejectCancel}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h3>Confirm Rejection</h3>
                <p>
                  Reject report <strong>#{selectedReport?.reportId || selectedReport?.id?.slice(0, 6).toUpperCase()}</strong> with this reason?
                </p>
                <p className="mr-modal-suggestion">{rejectReason}</p>
                <div className="mr-modal-btns">
                  <button className="mr-modal-btn mr-modal-btn--emb" onClick={handleRejectConfirm}>
                    ✔ Confirm Reject
                  </button>
                </div>
                <button className="mr-modal-cancel" onClick={() => setRejectConfirming(false)}>← Back</button>
              </>
            )}
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