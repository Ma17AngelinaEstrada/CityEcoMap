import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import AdminLayout from "./AdminLayout";
import "./ExportReports.css";
import { reverseGeocode, isCached } from '../../utils/geocode';

export default function ExportReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterAssigned, setFilterAssigned] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportHistory, setExportHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
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
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
        setReports(data);
      } catch (err) {
        console.error("Error fetching reports:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const getStatusClass = (status) => {
    if (status === "Pending") return "er-badge er-badge--pending";
    if (status === "Approved") return "er-badge er-badge--approved";
    if (status === "Ongoing" || status === "In Progress") return "er-badge er-badge--ongoing";
    if (status === "Resolved") return "er-badge er-badge--resolved";
    if (status === "Rejected") return "er-badge er-badge--rejected";
    return "er-badge";
  };

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

  const fetchExportHistory = async () => {
  try {
    const snapshot = await getDocs(collection(db, "exportedReports"));
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => (b.exportedAt?.toDate?.() || 0) - (a.exportedAt?.toDate?.() || 0));
    setExportHistory(data);
  } catch (err) {
    console.error("Error fetching export history:", err);
  }
};

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

  const formatDate = (ts) => {
    if (!ts) return "—";
    const date = ts.toDate?.();
    if (!date) return "—";
    return date.toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const buildRows = () =>
    filtered.map((r) => [
      `#${r.reportId || r.id.slice(0, 6).toUpperCase()}`,
      r.fullName || '—',
      r.email || 'Not provided',
      r.category || '—',
      r.subCategory === "Other" ? (r.subCategoryOther || "Other") : (r.subCategory || '—'),
      formatDate(r.createdAt),
      r.description || '—',
      [r.locationDescription, r.addressInput || (r.location ? (addresses[r.id] || `${r.location.lat.toFixed(4)}° N, ${r.location.lng.toFixed(4)}° E`) : null)]
        .filter(Boolean)
        .join(' — ') || '—',
      r.assignedTo || '—',
      r.status || 'Pending',
    ]);

  const headers = [
    "Report ID", "Submitted By", "Email", "Category", "Sub-Category",
    "Date Submitted", "Description", "Location", "Assigned To", "Status"
  ];

  const logExport = async (format) => {
  try {
    await addDoc(collection(db, "exportedReports"), {
      adminEmail: auth.currentUser?.email || "unknown",
      format,
      filters: {
        status: filterStatus,
        category: filterCategory,
        assignedTo: filterAssigned,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      },
      reportCount: filtered.length,
      exportedAt: serverTimestamp(),
    });
    fetchExportHistory();
  } catch (err) {
    console.error("Failed to log export:", err);
  }
};

  const handleExportPDF = () => {
  const docPdf = new jsPDF({ orientation: "landscape" });
  docPdf.setFontSize(14);
  docPdf.text("CityEcoMap — Report Summary", 14, 15);
  docPdf.setFontSize(9);
  docPdf.text(
    `Environmental Management Bureau, Lucena City | Generated: ${new Date().toLocaleString("en-PH")}`,
    14, 21
  );

  autoTable(docPdf, {
    startY: 27,
    head: [headers],
    body: buildRows(),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [26, 74, 26], textColor: 255 },
    columnStyles: { 6: { cellWidth: 40 }, 7: { cellWidth: 45 } },
  });

  docPdf.save(`CityEcoMap_Reports_${new Date().toISOString().slice(0, 10)}.pdf`);
  logExport("PDF");
};

  const handleExportExcel = () => {
  const wsData = [headers, ...buildRows()];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 18 },
    { wch: 20 }, { wch: 35 }, { wch: 30 }, { wch: 10 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reports");
  XLSX.writeFile(wb, `CityEcoMap_Reports_${new Date().toISOString().slice(0, 10)}.xlsx`);
  logExport("Excel");
};

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

  return (
    <AdminLayout>
      <div className="er-header">
        <h2 className="er-title">Generate & Export Reports</h2>
        <p className="er-subtitle">Filter reports and export them as PDF or Excel for record-keeping.</p>
      </div>

      <div className="er-filters">
        <div className="er-filter-group">
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
        <div className="er-filter-group">
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
        <div className="er-filter-group">
          <label>Assigned To</label>
          <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)}>
            <option>All</option>
            <option>EMB</option>
            <option>LGU</option>
          </select>
        </div>
        <div className="er-filter-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Report ID or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="mr-filters-tail">
          <div className="er-filter-group">
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
            <div className="er-filter-group">
              <label>Month</label>
              <input type="month" value={specificMonth} onChange={(e) => applySpecificMonth(e.target.value)} />
            </div>
          )}
          <div className="er-daterange-group">
            <div className="er-filter-group">
              <label>From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setQuickRange("custom"); }}
              />
            </div>
            <div className="er-filter-group">
              <label>To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setQuickRange("custom"); }}
              />
            </div>
          </div>
          <button
            className="er-clear-btn"
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
      </div>

      <div className="er-summary-bar">
        <span className="er-count">{filtered.length} report{filtered.length !== 1 ? "s" : ""} match your filters</span>
        <div className="er-export-btns">
          <button className="er-export-btn er-export-btn--pdf" onClick={handleExportPDF} disabled={filtered.length === 0}>
            📄 Export as PDF
          </button>
          <button className="er-export-btn er-export-btn--excel" onClick={handleExportExcel} disabled={filtered.length === 0}>
            📊 Export as Excel
          </button>
          <button
            className="er-history-btn"
            onClick={() => {
              if (!showHistory) fetchExportHistory();
              setShowHistory(!showHistory);
            }}
          >
            🕒 Export History
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="er-history-card">
          <h3 className="er-history-title">Export History</h3>
          {exportHistory.length === 0 ? (
            <p className="er-empty">No exports logged yet.</p>
          ) : (
            <table className="er-table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Format</th>
                  <th>Reports</th>
                  <th>Date Exported</th>
                </tr>
              </thead>
              <tbody>
                {exportHistory.map((h) => (
                  <tr key={h.id}>
                    <td>{h.adminEmail}</td>
                    <td>{h.format}</td>
                    <td>{h.reportCount}</td>
                    <td>{formatDate(h.exportedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {loading ? (
        <p className="er-loading">Loading reports...</p>
      ) : (
        <div className="er-table-card">
          <table className="er-table">
            <colgroup>
              <col style={{ width: "7%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
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
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="10" className="er-empty">No reports match the selected filters.</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id}>
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
                    </tr>
                  ))
                )}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}