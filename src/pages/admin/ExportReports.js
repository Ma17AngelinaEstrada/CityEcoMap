import { useEffect, useState, useRef } from "react";
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
import html2canvas from "html2canvas";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { useAdminTour } from "../../context/AdminTourContext";

const EXPORT_REPORTS_TOUR_STEPS = [
  {
    selector: '.er-filters',
    title: 'Filter Before Exporting',
    description: 'Narrow down which reports to export by status, category, sub-category, assigned office, date range, or a keyword/Report ID search.',
  },
  {
    selector: '.er-summary-bar',
    title: 'Export as PDF or Excel',
    description: 'Once your filters are set, export the matching reports as a PDF or Excel file for record-keeping.',
  },
  {
    selector: '.er-chart-preview',
    title: 'Include a Chart',
    description: 'Turn on "Include chart" to add a visual summary (by Category, Sub-Category, or Status) to your PDF export.',
  },
  {
    selector: '.er-table-card',
    title: 'Reports Table',
    description: 'Preview all reports matching your filters. Use the "Generate" button on any row to create a single-report PDF for that specific report.',
  },
  {
    selector: '.er-history-card',
    title: 'Export History',
    description: 'Every export is logged here — who exported it, in what format, and how many reports were included.',
  },
];

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
  const [includeChart, setIncludeChart] = useState(false);
  const chartRef = useRef(null);
  const [chartView, setChartView] = useState("category"); // "category" | "subcategory" | "status"
  const [chartParentCategory, setChartParentCategory] = useState("Waste Issue");
  const [adminNames, setAdminNames] = useState({});
  const { registerTour, showTour, currentStepIndex } = useAdminTour();

  useEffect(() => {
    registerTour(EXPORT_REPORTS_TOUR_STEPS, 'cityecomap_admin_tour_seen_export');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const CHART_STEP_INDEX = 2;
  const HISTORY_STEP_INDEX = 4;

  useEffect(() => {
    if (!showTour) {
      setIncludeChart(false);
      setShowHistory(false);
      return;
    }
    if (currentStepIndex === CHART_STEP_INDEX) {
      setIncludeChart(true);
    }
    if (currentStepIndex === HISTORY_STEP_INDEX) {
      setShowHistory(true);
      fetchExportHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTour, currentStepIndex]);

  const WASTE_SUBCATEGORIES = ["Illegal Dumping", "Uncollected Garbage", "Waste Affecting Rivers, Waterways, and Natural Water Bodies", "Other"];
  const DRAINAGE_SUBCATEGORIES = ["Blocked Drainage", "Damaged Drainage", "Flooding", "Other"];

  const KNOWN_SUBCATEGORIES = new Set([
    ...WASTE_SUBCATEGORIES.filter((s) => s !== "Other"),
    ...DRAINAGE_SUBCATEGORIES.filter((s) => s !== "Other"),
  ]);

  const isOtherSubCategory = (subCategory) => !KNOWN_SUBCATEGORIES.has(subCategory);

  const STATUS_LIST = ["Pending", "Approved", "Ongoing", "Resolved", "Rejected"];
  const statusColors = {
    Pending: '#e53935',
    Approved: '#1565c0',
    Ongoing: '#f9a825',
    Resolved: '#2e7d32',
    Rejected: '#757575',
  };
  const matchesStatus = (r, status) =>
    status === "Ongoing" ? (r.status === "Ongoing" || r.status === "In Progress") : r.status === status;

  const categoryColors = {
    "Waste Issue": "#2e7d32",
    "Drainage Issue": "#1565c0",
  };
  const subCategoryColorSets = {
    "Waste Issue": ["#2e7d32", "#66a06a", "#a5d6a7", "#8d8f6b"],
    "Drainage Issue": ["#1565c0", "#5e92d9", "#b3cde8", "#8a97a8"],
  };
  const SUBCATEGORY_SHORT_LABELS = {
    "Waste Affecting Rivers, Waterways, and Natural Water Bodies": "Rivers/Waterways",
  };
  const shortenLabel = (label) => SUBCATEGORY_SHORT_LABELS[label] || label;
  const activeSubCategories = chartParentCategory === "Waste Issue" ? WASTE_SUBCATEGORIES : DRAINAGE_SUBCATEGORIES;
  const subCategoryColors = subCategoryColorSets[chartParentCategory];
  const subcategoryBarColor = (category) => categoryColors[category] || "#aaaaaa";

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

  const getExportTimeBuckets = () => {
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      let start, end;

      if (dateFrom || dateTo) {
        start = dateFrom ? new Date(dateFrom) : null;
        end = dateTo ? new Date(dateTo) : null;
        if (!start) {
          const dates = filtered.map((r) => r.createdAt?.toDate?.()).filter(Boolean);
          start = dates.length ? new Date(Math.min(...dates)) : new Date();
        }
        if (!end) end = new Date();
      } else {
        const currentYear = new Date().getFullYear();
        start = new Date(currentYear, 0, 1);
        end = new Date(currentYear, 11, 31);
      }

      const spanDays = (end - start) / (1000 * 60 * 60 * 24);

      // Short ranges (~1 month or less) get weekly buckets instead of monthly,
      // matching AdminDashboard's "This Month"/"Last 4 Weeks" behavior — otherwise
      // e.g. "Last 1 Month" would collapse into 1–2 sparse monthly bars.
      if (spanDays <= 31) {
        const buckets = [];
        let wStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const rangeEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
        let weekNum = 1;
        while (wStart < rangeEnd) {
          const wEnd = new Date(wStart);
          wEnd.setDate(wStart.getDate() + 7);
          const clampedEnd = wEnd > rangeEnd ? rangeEnd : wEnd;
          buckets.push({ label: `Wk ${weekNum}`, start: new Date(wStart), end: clampedEnd });
          wStart = clampedEnd;
          weekNum++;
        }
        return buckets;
      }

      const buckets = [];
      let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
      const spansMultipleYears = start.getFullYear() !== end.getFullYear();

      while (cursor <= endMonth) {
        const y = cursor.getFullYear();
        const m = cursor.getMonth();
        buckets.push({
          label: spansMultipleYears ? `${monthNames[m]} '${String(y).slice(2)}` : monthNames[m],
          start: new Date(y, m, 1),
          end: new Date(y, m + 1, 1),
        });
        cursor = new Date(y, m + 1, 1);
      }
      return buckets;
    };

  const exportTimeBuckets = getExportTimeBuckets();

  const exportChartData = exportTimeBuckets.map(({ label, start, end }) => {
    const waste = filtered.filter((r) => {
      const date = r.createdAt?.toDate?.();
      return date && date >= start && date < end && r.category === "Waste Issue";
    }).length;
    const drainage = filtered.filter((r) => {
      const date = r.createdAt?.toDate?.();
      return date && date >= start && date < end && r.category === "Drainage Issue";
    }).length;
    return { month: label, "Waste Issues": waste, "Drainage Issues": drainage };
  });

  const exportSubCategoryChartData = exportTimeBuckets.map(({ label, start, end }) => {
    const row = { month: label };
    activeSubCategories.forEach((sub) => {
      row[sub] = filtered.filter((r) => {
        const date = r.createdAt?.toDate?.();
        const inBucket = date && date >= start && date < end;
        if (!inBucket || r.category !== chartParentCategory) return false;
        return sub === "Other" ? isOtherSubCategory(r.subCategory) : r.subCategory === sub;
      }).length;
    });
    return row;
  });

  const exportStatusChartData = ["Waste Issue", "Drainage Issue"].map((cat) => {
    const row = { category: cat === "Waste Issue" ? "Waste Issues" : "Drainage Issues" };
    STATUS_LIST.forEach((status) => {
      row[status] = filtered.filter((r) => r.category === cat && matchesStatus(r, status)).length;
    });
    return row;
  });

  const exportPieData = chartView === "category"
    ? ["Waste Issue", "Drainage Issue"].map((cat) => ({
        name: cat,
        value: filtered.filter((r) => r.category === cat).length,
      }))
    : chartView === "status"
    ? STATUS_LIST.map((status) => ({
        name: status,
        value: filtered.filter((r) => matchesStatus(r, status)).length,
      }))
    : activeSubCategories.map((sub) => ({
        name: shortenLabel(sub),
        value: filtered.filter((r) => {
          if (r.category !== chartParentCategory) return false;
          return sub === "Other" ? isOtherSubCategory(r.subCategory) : r.subCategory === sub;
        }).length,
      }));

  const exportPieColors = chartView === "category"
    ? ["Waste Issue", "Drainage Issue"].map((c) => categoryColors[c])
    : chartView === "status"
    ? STATUS_LIST.map((s) => statusColors[s])
    : subCategoryColors;

  const exportPieTotal = exportPieData.reduce((sum, d) => sum + d.value, 0);

  // Top Subcategories ranking — hiwalay na chart, hindi apektado ng chartView/chartParentCategory,
  // laging pinagsasama ang Waste at Drainage subcategories batay sa "filtered" (kasama na ang
  // lahat ng existing filters sa itaas ng page: Status, Category, Time Range, atbp.)
  const subcategoryCategoryMap = {};
  WASTE_SUBCATEGORIES.forEach((s) => { if (s !== "Other") subcategoryCategoryMap[s] = "Waste Issue"; });
  DRAINAGE_SUBCATEGORIES.forEach((s) => { if (s !== "Other") subcategoryCategoryMap[s] = "Drainage Issue"; });

  const exportTopSubcategoryData = Object.entries(subcategoryCategoryMap)
    .map(([name, cat]) => ({
      name: shortenLabel(name),
      count: filtered.filter((r) => r.category === cat && r.subCategory === name).length,
      category: cat,
    }))
    .concat([
      {
        name: "Other (Waste)",
        count: filtered.filter((r) => r.category === "Waste Issue" && isOtherSubCategory(r.subCategory)).length,
        category: "Waste Issue",
      },
      {
        name: "Other (Drainage)",
        count: filtered.filter((r) => r.category === "Drainage Issue" && isOtherSubCategory(r.subCategory)).length,
        category: "Drainage Issue",
      },
    ])
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);

  // Ang chart ay awtomatikong naka-sync na sa Time Range filter sa itaas (dahil parehong
  // "filtered" ang pinagbabatayan) — ito lang ang nagpapakita kung anong range talaga
  // ang kasalukuyang ipinapakita, dahil hindi laging tumutugma ang quickRange dropdown
  // label sa aktwal na dateFrom/dateTo (hal. pag manual na binago ang date inputs).
  const chartRangeLabel = (() => {
    if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`;
    if (dateFrom) return `From ${dateFrom}`;
    if (dateTo) return `Until ${dateTo}`;
    return "All Time";
  })();

  const buildRows = () =>
    filtered.map((r) => [
      `#${r.reportId || r.id.slice(0, 6).toUpperCase()}`,
      r.fullName || '—',
      r.email || 'Not provided',
      r.category || '—',
      r.subCategory === "Other" ? (r.subCategoryOther || "Other") : (r.subCategory || '—'),
      r.areaType || '—',
      formatDate(r.createdAt),
      r.description || '—',
      [r.locationDescription, r.addressInput || (r.location ? (addresses[r.id] || `${r.location.lat.toFixed(4)}° N, ${r.location.lng.toFixed(4)}° E`) : null)]
        .filter(Boolean)
        .join(' — ') || '—',
      r.assignedTo || '—',
      r.status || 'Pending',
    ]);

  const headers = [
    "Report ID", "Submitted By", "Email", "Category", "Sub-Category", "Type of Area",
    "Date Submitted", "Description", "Location", "Assigned To", "Status"
  ];

  const logExport = async (format) => {
    try {
      await addDoc(collection(db, "exportedReports"), {
        adminEmail: auth.currentUser?.email || "unknown",
        format,
        chartIncluded: format === "PDF" ? includeChart : false,
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

  const logExportSingle = async (reportId) => {
    try {
      await addDoc(collection(db, "exportedReports"), {
        adminEmail: auth.currentUser?.email || "unknown",
        format: `PDF (Single — #${reportId})`,
        filters: null,
        reportCount: 1,
        exportedAt: serverTimestamp(),
      });
      fetchExportHistory();
    } catch (err) {
      console.error("Failed to log export:", err);
    }
  };

  const handleExportPDF = async () => {
    const docPdf = new jsPDF({ orientation: "landscape" });
    docPdf.setFontSize(14);
    docPdf.text("CityEcoMap — Report Summary", 14, 15);
    docPdf.setFontSize(9);
    docPdf.text(
      `Environmental Management Bureau, Lucena City | Generated: ${new Date().toLocaleString("en-PH")}`,
      14, 21
    );

    let tableStartY = 27;

    if (includeChart && chartRef.current) {
      try {
        const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: "#ffffff" });
        const imgData = canvas.toDataURL("image/png");
        const imgWidth = 260;
        const imgHeight = (canvas.height / canvas.width) * imgWidth;
        docPdf.addImage(imgData, "PNG", 14, 26, imgWidth, imgHeight);

        const captionY = 26 + imgHeight + 6;
        docPdf.setFontSize(8);
        docPdf.setTextColor(110);
        docPdf.text(
          "Figure: Report volume breakdown and top subcategories, based on the filtered reports below.",
          14, captionY
        );

        tableStartY = captionY + 8;
      } catch (err) {
        console.error("Failed to capture chart:", err);
      }
    }

    autoTable(docPdf, {
      startY: tableStartY,
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
    if (includeChart) {
      const proceed = window.confirm(
        "Note: Charts are not supported in Excel exports — only the report table will be included. Continue with Excel export?"
      );
      if (!proceed) return;
    }

    const rows = buildRows();
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const MIN_WIDTH = 10;
    const MAX_WIDTH = 45;
    ws["!cols"] = headers.map((header, colIndex) => {
      let maxLen = String(header).length;
      rows.forEach((row) => {
        const cell = row[colIndex];
        if (cell != null) {
          const len = String(cell).length;
          if (len > maxLen) maxLen = len;
        }
      });
      return { wch: Math.min(Math.max(maxLen + 2, MIN_WIDTH), MAX_WIDTH) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reports");
    XLSX.writeFile(wb, `CityEcoMap_Reports_${new Date().toISOString().slice(0, 10)}.xlsx`);
    logExport("Excel");
  };

  const handleGenerateSingleReport = (r) => {
    const docPdf = new jsPDF({ orientation: "portrait" });

    docPdf.setFontSize(14);
    docPdf.text("CityEcoMap — Incident Report", 14, 18);
    docPdf.setFontSize(9);
    docPdf.text(
      `Lucena City Environmental Reporting System | Generated: ${new Date().toLocaleString("en-PH")}`,
      14, 24
    );
    docPdf.setLineWidth(0.3);
    docPdf.line(14, 28, 196, 28);

    let y = 38;
    const addRow = (label, value) => {
      docPdf.setFontSize(9);
      docPdf.setTextColor(120);
      docPdf.text(label.toUpperCase(), 14, y);
      docPdf.setFontSize(11);
      docPdf.setTextColor(30);
      const lines = docPdf.splitTextToSize(value || "—", 170);
      docPdf.text(lines, 14, y + 6);
      y += 6 + lines.length * 6 + 4;
    };

    addRow("Report ID", `#${r.reportId || r.id.slice(0, 6).toUpperCase()}`);
    addRow("Date Submitted", formatDate(r.createdAt));
    addRow("Submitted By", r.fullName || "—");
    addRow("Email", r.email || "Not provided");
    addRow("Category", r.category || "—");
    addRow(
      "Sub-Category",
      r.subCategory === "Other" ? (r.subCategoryOther || "Other") : (r.subCategory || "—")
    );
    addRow("Type of Area", r.areaType || "Not specified");
    addRow(
      "Location",
      [r.locationDescription, r.addressInput].filter(Boolean).join(" — ") || "—"
    );
    if (r.location?.lat && r.location?.lng) {
      addRow("Coordinates", `Lat: ${r.location.lat.toFixed(5)}, Long: ${r.location.lng.toFixed(5)}`);
    }
    addRow("Description", r.description || "—");
    addRow("Status", r.status || "Pending");
    addRow("Assigned To", r.assignedTo || "—");
    if (r.status === "Rejected" && r.rejectionReason) {
      addRow("Rejection Reason", r.rejectionReason);
    }

      if (r.photo) {
        if (y > 180) {
          docPdf.addPage();
          y = 20;
        }
        docPdf.setFontSize(9);
        docPdf.setTextColor(120);
        docPdf.text("PHOTO DOCUMENTATION", 14, y);
        y += 6;
        try {
          const props = docPdf.getImageProperties(r.photo);
          const maxWidth = 160;
          const maxHeight = 100;
          let imgW = props.width;
          let imgH = props.height;
          const scale = Math.min(maxWidth / imgW, maxHeight / imgH);
          imgW = imgW * scale;
          imgH = imgH * scale;
          docPdf.addImage(r.photo, "JPEG", 14, y, imgW, imgH);
          y += imgH + 6;
        } catch (err) {
          console.error("Failed to embed photo:", err);
        }
      }

      docPdf.save(`CityEcoMap_${r.reportId || r.id.slice(0, 6).toUpperCase()}.pdf`);
      logExportSingle(r.reportId || r.id.slice(0, 6).toUpperCase());
    };

    const toLocalISODate = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const applyQuickRange = (value) => {
        setQuickRange(value);
        const today = new Date();

        if (value === "all") {
          setDateFrom("");
          setDateTo("");
          setSpecificMonth("");
          return;
        }

        if (value === "thisMonth") {
          const from = new Date(today.getFullYear(), today.getMonth(), 1);
          const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          setDateFrom(toLocalISODate(from));
          setDateTo(toLocalISODate(to));
          setSpecificMonth("");
          return;
        }

        if (value === "last4weeks") {
          const from = new Date(today);
          from.setDate(from.getDate() - 27);
          setDateFrom(toLocalISODate(from));
          setDateTo(toLocalISODate(today));
          setSpecificMonth("");
          return;
        }

        if (value === "last3") {
          const from = new Date(today);
          from.setMonth(from.getMonth() - 3);
          setDateFrom(toLocalISODate(from));
          setDateTo(toLocalISODate(today));
          setSpecificMonth("");
          return;
        }

        if (value === "quarter") {
          const q = Math.floor(today.getMonth() / 3);
          const from = new Date(today.getFullYear(), q * 3, 1);
          const to = new Date(today.getFullYear(), q * 3 + 3, 0);
          setDateFrom(toLocalISODate(from));
          setDateTo(toLocalISODate(to));
          setSpecificMonth("");
          return;
        }

        if (value === "thisYear") {
          const from = new Date(today.getFullYear(), 0, 1);
          const to = new Date(today.getFullYear(), 11, 31);
          setDateFrom(toLocalISODate(from));
          setDateTo(toLocalISODate(to));
          setSpecificMonth("");
          return;
        }

        if (value === "specific") {
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
      setDateFrom(toLocalISODate(from));
      setDateTo(toLocalISODate(to));
    };
    
  useEffect(() => {
    const fetchAdminNames = async () => {
      try {
        const snapshot = await getDocs(collection(db, "admins"));
        const map = {};
        snapshot.docs.forEach((d) => {
          const data = d.data();
          if (data.email) map[data.email.toLowerCase()] = data.name;
        });
        setAdminNames(map);
      } catch (err) {
        console.error("Error fetching admin names:", err);
      }
    };
    fetchAdminNames();
  }, []);

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
              <option value="thisMonth">This Month</option>
              <option value="last4weeks">Last 4 Weeks</option>
              <option value="last3">Last 3 Months</option>
              <option value="quarter">This Quarter</option>
              <option value="thisYear">This Year</option>
              <option value="all">All Time</option>
              <option value="specific">Specific Month</option>
            </select>
          </div>
          {quickRange === "specific" && (
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
          {includeChart && (
            <>
              <div className="er-filter-group" style={{ marginBottom: 0 }}>
                <label>Chart View</label>
                <select value={chartView} onChange={(e) => setChartView(e.target.value)}>
                  <option value="category">By Category</option>
                  <option value="subcategory">By Sub-Category</option>
                  <option value="status">By Status</option>
                </select>
              </div>
              {chartView === "subcategory" && (
                <div className="er-filter-group" style={{ marginBottom: 0 }}>
                  <label>Category</label>
                  <select value={chartParentCategory} onChange={(e) => setChartParentCategory(e.target.value)}>
                    <option value="Waste Issue">Waste Issue</option>
                    <option value="Drainage Issue">Drainage Issue</option>
                  </select>
                </div>
              )}
            </>
          )}
          <label className="er-chart-toggle">
            <input
              type="checkbox"
              checked={includeChart}
              onChange={(e) => setIncludeChart(e.target.checked)}
            />
            Include chart
          </label>
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
                  <th>Chart</th>
                  <th>Reports</th>
                  <th>Date Exported</th>
                </tr>
              </thead>
              <tbody>
                {exportHistory.map((h) => (
                  <tr key={h.id}>
                    <td>{adminNames[h.adminEmail?.toLowerCase()] || h.adminEmail}</td>
                    <td>{h.format}</td>
                    <td>{h.chartIncluded ? "Yes" : "—"}</td>
                    <td>{h.reportCount}</td>
                    <td>{formatDate(h.exportedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

            {includeChart && (
        <div
          ref={chartRef}
          className="er-chart-preview"
          style={{
            background: "#fff",
            padding: "20px",
            width: "1400px",
            maxWidth: "100%",
            marginBottom: "24px",
            borderRadius: "10px",
            border: "1px solid #e0ddd5",
            display: "flex",
            gap: "24px",
            alignItems: "flex-start",
          }}
        >
          {/* Kaliwang column: Report Statistics (bar + donut) — parehong laman ng
              "chartView" dropdown, kapareho ng Dashboard */}
          <div style={{ flex: 1.4, minWidth: 0 }}>
            <h4 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1a4a1a", fontFamily: "sans-serif", marginBottom: "4px" }}>
              Report Statistics
            </h4>
            <p style={{ fontSize: "0.75rem", color: "#888", fontFamily: "sans-serif", marginBottom: "12px" }}>
              {chartRangeLabel}
            </p>
            <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
              <div style={{ flex: 1.6, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height={260}>
                  {chartView === "category" ? (
                    <BarChart data={exportChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} interval={0} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Waste Issues" fill={categoryColors["Waste Issue"]} radius={[0, 0, 0, 0]} stackId="a" />
                      <Bar dataKey="Drainage Issues" fill={categoryColors["Drainage Issue"]} radius={[3, 3, 0, 0]} stackId="a" />
                    </BarChart>
                  ) : chartView === "subcategory" ? (
                    <BarChart data={exportSubCategoryChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} interval={0} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip formatter={(value, name) => [value, shortenLabel(name)]} contentStyle={{ maxWidth: 200, fontSize: '0.78rem' }} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      {activeSubCategories.map((sub, i) => (
                        <Bar
                          key={sub}
                          dataKey={sub}
                          fill={subCategoryColors[i % subCategoryColors.length]}
                          radius={i === activeSubCategories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                          stackId="b"
                        />
                      ))}
                    </BarChart>
                  ) : (
                    <BarChart data={exportStatusChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      {STATUS_LIST.map((status, i) => (
                        <Bar
                          key={status}
                          dataKey={status}
                          fill={statusColors[status]}
                          radius={i === STATUS_LIST.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                          stackId="c"
                        />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                {exportPieTotal === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#999', fontFamily: 'sans-serif' }}>No reports match the current filters.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={exportPieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={72}
                          paddingAngle={2}
                        >
                          {exportPieData.map((entry, i) => (
                            <Cell key={entry.name} fill={exportPieColors[i % exportPieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "8px", fontSize: "12px", fontFamily: "sans-serif", justifyContent: "center" }}>
                      {exportPieData.filter((d) => d.value > 0).map((d, i) => (
                        <span key={d.name} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: exportPieColors[exportPieData.indexOf(d) % exportPieColors.length], display: "inline-block" }}></span>
                          {d.name}: {d.value}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Kanang column: Top Subcategories ranking — laging pinagsama ang Waste +
              Drainage, batay sa lahat ng existing filters sa itaas (Status, Category,
              Time Range, atbp.); parehong border-left separator ng Dashboard columns */}
          <div style={{ flex: 1, minWidth: 0, borderLeft: "1px solid #eee", paddingLeft: "24px" }}>
            <h4 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1a4a1a", fontFamily: "sans-serif", marginBottom: "4px" }}>
              Top Subcategories
            </h4>
            <p style={{ fontSize: "0.75rem", color: "#888", fontFamily: "sans-serif", marginBottom: "12px" }}>
              {chartRangeLabel}
            </p>
            {exportTopSubcategoryData.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#999', fontFamily: 'sans-serif' }}>No reports match the current filters.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, exportTopSubcategoryData.length * 34)}>
                <BarChart
                  data={exportTopSubcategoryData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                    {exportTopSubcategoryData.map((entry) => (
                      <Cell key={entry.name} fill={subcategoryBarColor(entry.category)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
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
              <col style={{ width: "9%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Submitted By</th>
                <th>Email</th>
                <th>Category</th>
                <th>Type of Area</th>
                <th>Date Submitted</th>
                <th>Description</th>
                <th>Location</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Report</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="11" className="er-empty">No reports match the selected filters.</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id}>
                      <td>#{r.reportId || r.id.slice(0, 6).toUpperCase()}</td>
                      <td>{r.fullName || "—"}</td>
                      <td>{r.email || "—"}</td>
                      <td>
                        <div>{r.category}</div>
                        <div style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>
                          {r.subCategory === "Other"
                            ? (r.subCategoryOther || "Other")
                            : (r.subCategory || "—")}
                        </div>
                      </td>
                      <td>{r.areaType || "—"}</td>
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
                          className="er-generate-btn"
                          onClick={() => handleGenerateSingleReport(r)}
                        >
                          📄 Generate
                        </button>
                      </td>
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
