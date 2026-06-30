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
import { reverseGeocode } from '../../utils/geocode';

export default function ExportReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});

  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterAssigned, setFilterAssigned] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportHistory, setExportHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

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

  useEffect(() => {
    const resolveAddresses = async () => {
      const newAddresses = {};
      for (const r of reports) {
        if (r.location?.lat && r.location?.lng) {
          const addr = await reverseGeocode(r.location.lat, r.location.lng);
          newAddresses[r.id] = addr;
          await new Promise((res) => setTimeout(res, 1100));
        }
      }
      if (Object.keys(newAddresses).length > 0) {
        setAddresses((prev) => ({ ...prev, ...newAddresses }));
      }
    };
    if (reports.length > 0) resolveAddresses();
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
    const matchAssigned = filterAssigned === "All" || r.assignedTo === filterAssigned;

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
    return matchStatus && matchCategory && matchAssigned && matchDate;
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
      r.category || '—',
      formatDate(r.createdAt),
      r.locationDescription || (r.location ? (addresses[r.id] || `${r.location.lat.toFixed(4)}° N, ${r.location.lng.toFixed(4)}° E`) : '—'),
      r.assignedTo || '—',
      r.status || 'Pending',
      r.email || 'Not provided',
      r.description || '—',
    ]);

  const headers = [
    "Report ID", "Type", "Date Submitted", "Location",
    "Assigned To", "Status", "Email", "Description"
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
    columnStyles: { 7: { cellWidth: 60 } },
  });

  docPdf.save(`CityEcoMap_Reports_${new Date().toISOString().slice(0, 10)}.pdf`);
  logExport("PDF");
};

  const handleExportExcel = () => {
  const wsData = [headers, ...buildRows()];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 24 },
    { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 40 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reports");
  XLSX.writeFile(wb, `CityEcoMap_Reports_${new Date().toISOString().slice(0, 10)}.xlsx`);
  logExport("Excel");
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
        <div className="er-filter-group">
          <label>Assigned To</label>
          <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)}>
            <option>All</option>
            <option>EMB</option>
            <option>LGU</option>
          </select>
        </div>
        <div className="er-filter-group">
          <label>From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="er-filter-group">
          <label>To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button
          className="er-clear-btn"
          onClick={() => {
            setFilterStatus("All");
            setFilterCategory("All");
            setFilterAssigned("All");
            setDateFrom("");
            setDateTo("");
          }}
        >
          Clear Filters
        </button>
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
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Type</th>
                <th>Date Submitted</th>
                <th>Location</th>
                <th>Assigned To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="6" className="er-empty">No reports match the selected filters.</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
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
                    <td>{r.status || "Pending"}</td>
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