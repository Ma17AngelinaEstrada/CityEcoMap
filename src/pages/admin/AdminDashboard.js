import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import AdminLayout from "./AdminLayout";
import "./AdminDashboard.css";
import { GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { reverseGeocode, isCached } from '../../utils/geocode';
import { SearchIcon, CalendarIcon, PinIcon, BuildingIcon } from '../../components/Icons';
import { useGoogleMapsLoaded } from "../../context/GoogleMapsLoaderContext";
import { useAdminTour } from "../../context/AdminTourContext";

const statusColors = {
  'Pending':  '#e53935',
  'Approved': '#1565c0',
  'Ongoing':  '#f9a825',
  'Resolved': '#2e7d32',
  'Rejected': '#757575',
};

const LUCENA_CENTER = { lat: 13.9394, lng: 121.6169 };
const adminMapContainerStyle = { width: '100%', height: '100%' };

const DASHBOARD_TOUR_STEPS = [
  {
    selector: '.al2-notif-wrapper',
    title: 'New Report Alerts',
    description: 'This bell shows new reports as soon as they come in. Click it to see which ones are waiting for your review.',
  },
  {
    selector: '.ad-stats',
    title: 'Report Statistics at a Glance',
    description: 'These cards show the total number of reports and how many are Pending, Approved, Ongoing, Resolved, or Rejected.',
  },
  {
    selector: '.ad-overview-left',
    title: 'Report Trends',
    description: 'View report volume over time. Switch between By Category, By Sub-Category, or By Status using the dropdowns, and adjust the time range.',
  },
  {
    selector: '.ad-overview-right',
    title: 'Top Subcategories',
    description: 'See which specific issue types (like Illegal Dumping or Blocked Drainage) are reported the most.',
  },
  {
    selector: '.ad-map-card',
    title: 'Report Map',
    description: 'View all reports on the map. Use the search bar, filters, or fullscreen button to explore. Click a marker or a report in the sidebar to see details.',
  },
  {
    selector: '.ad-table-card',
    title: 'Recent Reports',
    description: 'A quick look at the latest submitted reports. Click "View all" to go to the full Manage & Resolve Reports page.',
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapFilterStatus, setMapFilterStatus] = useState('All');
  const [mapFilterCategory, setMapFilterCategory] = useState('All');
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);
  const adminMapRef = useRef(null);
  const [chartView, setChartView] = useState("category"); // "category" | "subcategory"
  const [chartParentCategory, setChartParentCategory] = useState("Waste Issue");
  const [chartTimeRange, setChartTimeRange] = useState("year"); // "year" | "quarter" | "last3" | "last1"
  const { isLoaded } = useGoogleMapsLoaded();
  const [mapTimeRange, setMapTimeRange] = useState("all"); // "all" | "year" | "quarter" | "last3" | "last1"
  const { registerTour } = useAdminTour();

  // Register this page's tour steps with the shared AdminLayout tour system
  useEffect(() => {
    registerTour(DASHBOARD_TOUR_STEPS, 'cityecomap_admin_tour_seen_dashboard');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "reports"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setReports(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching reports:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

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
              await new Promise((res) => setTimeout(res, 1100));
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

  const total = reports.length;
  const totalWaste = reports.filter((r) => r.category === "Waste Issue").length;
  const totalDrainage = reports.filter((r) => r.category === "Drainage Issue").length;
  const pending = reports.filter((r) => r.status === "Pending").length;
  const approved = reports.filter((r) => r.status === "Approved").length;
  const ongoing = reports.filter((r) => r.status === "Ongoing" || r.status === "In Progress").length;
  const resolved = reports.filter((r) => r.status === "Resolved").length;
  const rejected = reports.filter((r) => r.status === "Rejected").length;

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const currentYear = new Date().getFullYear();

  const RANGE_LABELS = {
    month: `This Month (${monthNames[new Date().getMonth()]})`,
    quarter: "This Quarter",
    last3: "Last 3 Months",
    last1: "Last 4 Weeks",
    year: `This Year (${currentYear})`,
  };

  const getTimeBuckets = (range) => {
    const now = new Date();

    if (range === "year") {
      return monthNames.map((label, m) => ({
        label,
        start: new Date(currentYear, m, 1),
        end: new Date(currentYear, m + 1, 1),
      }));
    }

    if (range === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const buckets = [];
      let wStart = new Date(monthStart);
      let weekNum = 1;
      while (wStart < monthEnd) {
        const wEnd = new Date(wStart);
        wEnd.setDate(wStart.getDate() + 7);
        const clampedEnd = wEnd > monthEnd ? monthEnd : wEnd;
        buckets.push({ label: `Wk ${weekNum}`, start: new Date(wStart), end: clampedEnd });
        wStart = clampedEnd;
        weekNum++;
      }
      return buckets;
    }

    if (range === "quarter") {
      const q = Math.floor(now.getMonth() / 3);
      return [0, 1, 2].map((i) => {
        const m = q * 3 + i;
        return {
          label: monthNames[m],
          start: new Date(now.getFullYear(), m, 1),
          end: new Date(now.getFullYear(), m + 1, 1),
        };
      });
    }

    if (range === "last3") {
      return [2, 1, 0].map((i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return {
          label: monthNames[d.getMonth()],
          start: d,
          end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
        };
      });
    }

    // last1: last 4 weeks, weekly buckets
    const rangeStart = new Date(now);
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - 27);
    return [0, 1, 2, 3].map((i) => {
      const wStart = new Date(rangeStart);
      wStart.setDate(rangeStart.getDate() + i * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 7);
      return { label: `Wk ${i + 1}`, start: wStart, end: wEnd };
    });
  };

  const timeBuckets = getTimeBuckets(chartTimeRange);
  const rangeStart = timeBuckets[0]?.start;
  const rangeEnd = timeBuckets[timeBuckets.length - 1]?.end;

  const inSelectedRange = (r) => {
    const date = r.createdAt?.toDate?.();
    return Boolean(date) && rangeStart && rangeEnd && date >= rangeStart && date < rangeEnd;
  };

  const mapTimeBuckets = mapTimeRange === "all" ? null : getTimeBuckets(mapTimeRange);
  const mapRangeStart = mapTimeBuckets?.[0]?.start;
  const mapRangeEnd = mapTimeBuckets?.[mapTimeBuckets.length - 1]?.end;

  const inMapTimeRange = (r) => {
    if (mapTimeRange === "all") return true;
    const date = r.createdAt?.toDate?.();
    return Boolean(date) && mapRangeStart && mapRangeEnd && date >= mapRangeStart && date < mapRangeEnd;
  };

  const chartData = timeBuckets.map(({ label, start, end }) => {
    const waste = reports.filter((r) => {
      const date = r.createdAt?.toDate?.();
      return date && date >= start && date < end && r.category === "Waste Issue";
    }).length;
    const drainage = reports.filter((r) => {
      const date = r.createdAt?.toDate?.();
      return date && date >= start && date < end && r.category === "Drainage Issue";
    }).length;
    return { month: label, "Waste Issues": waste, "Drainage Issues": drainage };
  });

  const WASTE_SUBCATEGORIES = ["Illegal Dumping", "Uncollected Garbage", "Waste Affecting Rivers, Waterways, and Natural Water Bodies", "Other"];
  const DRAINAGE_SUBCATEGORIES = ["Blocked Drainage", "Damaged Drainage", "Flooding", "Other"];
  const KNOWN_SUBCATEGORIES = new Set([
    ...WASTE_SUBCATEGORIES.filter((s) => s !== "Other"),
    ...DRAINAGE_SUBCATEGORIES.filter((s) => s !== "Other"),
  ]);
  const isOtherSubCategory = (subCategory) =>
    Boolean(subCategory) && !KNOWN_SUBCATEGORIES.has(subCategory);

  const activeSubCategories = chartParentCategory === "Waste Issue" ? WASTE_SUBCATEGORIES : DRAINAGE_SUBCATEGORIES;

  const subCategoryChartData = timeBuckets.map(({ label, start, end }) => {
    const row = { month: label };
    activeSubCategories.forEach((sub) => {
      row[sub] = reports.filter((r) => {
        const date = r.createdAt?.toDate?.();
        const inBucket = date && date >= start && date < end;
        if (!inBucket || r.category !== chartParentCategory) return false;
        return sub === "Other" ? isOtherSubCategory(r.subCategory) : r.subCategory === sub;
      }).length;
    });
    return row;
  });

  const STATUS_LIST = ["Pending", "Approved", "Ongoing", "Resolved", "Rejected"];

  const matchesStatus = (r, status) =>
    status === "Ongoing" ? (r.status === "Ongoing" || r.status === "In Progress") : r.status === status;

  const statusByCategoryChartData = ["Waste Issue", "Drainage Issue"].map((cat) => {
    const row = { category: cat === "Waste Issue" ? "Waste Issues" : "Drainage Issues" };
    STATUS_LIST.forEach((status) => {
      row[status] = reports.filter((r) => inSelectedRange(r) && r.category === cat && matchesStatus(r, status)).length;
    });
    return row;
  });

  const SUBCATEGORY_SHORT_LABELS = {
    "Waste Affecting Rivers, Waterways, and Natural Water Bodies": "Rivers/Waterways",
  };

  const shortenLabel = (label) => SUBCATEGORY_SHORT_LABELS[label] || label;

  const categoryColors = {
    "Waste Issue": "#2e7d32",
    "Drainage Issue": "#1565c0",
  };

  const subCategoryColorSets = {
    "Waste Issue": ["#2e7d32", "#66a06a", "#a5d6a7", "#8d8f6b"],
    "Drainage Issue": ["#1565c0", "#5e92d9", "#b3cde8", "#8a97a8"],
  };

  const subCategoryColors = subCategoryColorSets[chartParentCategory];

  const pieData = chartView === "category"
    ? ["Waste Issue", "Drainage Issue"].map((cat) => ({
        name: cat,
        value: reports.filter((r) => inSelectedRange(r) && r.category === cat).length,
      }))
    : chartView === "status"
    ? STATUS_LIST.map((status) => ({
        name: status,
        value: reports.filter((r) => inSelectedRange(r) && matchesStatus(r, status)).length,
      }))
    : activeSubCategories.map((sub) => ({
        name: shortenLabel(sub),
        value: reports.filter((r) => {
          if (!inSelectedRange(r) || r.category !== chartParentCategory) return false;
          return sub === "Other" ? isOtherSubCategory(r.subCategory) : r.subCategory === sub;
        }).length,
      }));

  const pieColors = chartView === "category"
    ? ["Waste Issue", "Drainage Issue"].map((c) => categoryColors[c])
    : chartView === "status"
    ? STATUS_LIST.map((s) => statusColors[s])
    : subCategoryColors;
  const pieTotal = pieData.reduce((sum, d) => sum + d.value, 0);

  const subcategoryCategoryMap = {};
  WASTE_SUBCATEGORIES.forEach((s) => { if (s !== "Other") subcategoryCategoryMap[s] = "Waste Issue"; });
  DRAINAGE_SUBCATEGORIES.forEach((s) => { if (s !== "Other") subcategoryCategoryMap[s] = "Drainage Issue"; });

  const topSubcategoryData = Object.entries(subcategoryCategoryMap)
    .map(([name, cat]) => ({
      name: shortenLabel(name),
      count: reports.filter((r) => inSelectedRange(r) && r.category === cat && r.subCategory === name).length,
      category: cat,
    }))
    .concat([
      {
        name: "Other (Waste)",
        count: reports.filter((r) => inSelectedRange(r) && r.category === "Waste Issue" && isOtherSubCategory(r.subCategory)).length,
        category: "Waste Issue",
      },
      {
        name: "Other (Drainage)",
        count: reports.filter((r) => inSelectedRange(r) && r.category === "Drainage Issue" && isOtherSubCategory(r.subCategory)).length,
        category: "Drainage Issue",
      },
    ])
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);

  const subcategoryBarColor = (category) => categoryColors[category] || "#aaaaaa";

  const recent = [...reports]
    .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
    .slice(0, 7);

  const mapMarkers = reports.filter((r) => {
    const hasLocation = r.location?.lat && r.location?.lng;
    const matchStatus = mapFilterStatus === 'All' || r.status === mapFilterStatus;
    const matchCategory = mapFilterCategory === 'All' || r.category === mapFilterCategory;
    return hasLocation && matchStatus && matchCategory && inMapTimeRange(r);
  });

  const getStatusClass = (status) => {
    if (status === "Pending") return "ad-badge ad-badge--pending";
    if (status === "Approved") return "ad-badge ad-badge--approved";
    if (status === "Ongoing" || status === "In Progress") return "ad-badge ad-badge--inprogress";
    if (status === "Resolved") return "ad-badge ad-badge--resolved";
    if (status === "Rejected") return "ad-badge ad-badge--rejected";
    return "ad-badge";
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

  const onAdminMapLoad = useCallback((map) => {
    adminMapRef.current = map;
    map.addListener('heading_changed', () => {
      if (map.getHeading() !== 0) map.setHeading(0);
    });
    map.addListener('tilt_changed', () => {
      if (map.getTilt() !== 0) map.setTilt(0);
    });
  }, []);

  const getMarkerIcon = (color) => ({
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: 'white',
    strokeWeight: 2,
    scale: 10,
  });

  const handleMapSearch = async (e) => {
    if (e.key !== 'Enter') return;
    if (!mapSearchQuery.trim()) return;

    const cleanQuery = mapSearchQuery.trim().replace('#', '').toUpperCase();
    const matchedReport = reports.find(
      (r) => r.reportId?.toUpperCase() === cleanQuery
    );

    if (matchedReport && matchedReport.location?.lat && matchedReport.location?.lng) {
      adminMapRef.current?.panTo({ lat: matchedReport.location.lat, lng: matchedReport.location.lng });
      adminMapRef.current?.setZoom(17);
      setTimeout(() => {
        setActiveInfoWindow(matchedReport.id);
      }, 800);
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapSearchQuery)}&format=json&limit=1&countrycodes=ph`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        adminMapRef.current?.panTo({ lat: parseFloat(lat), lng: parseFloat(lon) });
        adminMapRef.current?.setZoom(16);
      } else {
        alert('No matching report or location found.');
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const panToReport = (report) => {
    if (!report.location?.lat || !report.location?.lng) return;
    adminMapRef.current?.panTo({ lat: report.location.lat, lng: report.location.lng });
    adminMapRef.current?.setZoom(17);
    setTimeout(() => setActiveInfoWindow(report.id), 500);
  };

  return (
    <AdminLayout>
      {loading ? (
        <p className="ad-loading">Loading reports...</p>
      ) : (
        <>
          {/* 6 Stat cards */}
          <div className="ad-stats">
            <div className="ad-stat-card ad-stat-card--total">
              <span className="ad-stat-label">Total Reports</span>
              <span className="ad-stat-number">{total}</span>
              <span className="ad-stat-desc">
                All reports submitted to date<br />
                Waste: {totalWaste} · Drainage: {totalDrainage}
              </span>
            </div>
            <div className="ad-stat-card ad-stat-card--pending">
              <span className="ad-stat-label">Pending</span>
              <span className="ad-stat-number">{pending}</span>
              <span className="ad-stat-desc">Awaiting admin review</span>
            </div>
            <div className="ad-stat-card ad-stat-card--approved">
              <span className="ad-stat-label">Approved</span>
              <span className="ad-stat-number">{approved}</span>
              <span className="ad-stat-desc">Reviewed and assigned</span>
            </div>
            <div className="ad-stat-card ad-stat-card--ongoing">
              <span className="ad-stat-label">Ongoing</span>
              <span className="ad-stat-number">{ongoing}</span>
              <span className="ad-stat-desc">Cleanup in progress</span>
            </div>
            <div className="ad-stat-card ad-stat-card--resolved">
              <span className="ad-stat-label">Resolved</span>
              <span className="ad-stat-number">{resolved}</span>
              <span className="ad-stat-desc">Issue successfully resolved</span>
            </div>
            <div className="ad-stat-card ad-stat-card--rejected">
              <span className="ad-stat-label">Rejected</span>
              <span className="ad-stat-number">{rejected}</span>
              <span className="ad-stat-desc">Not approved for action</span>
            </div>
          </div>

          {/* Report Statistics + Top Subcategories row */}
          <div className="ad-overview-row">
            <div className="ad-overview-left">
              <div className="ad-chart-header">
                <h3 className="ad-chart-title">Report Statistics — {RANGE_LABELS[chartTimeRange]}</h3>
                <div className="ad-chart-filters">
                  <div className="ad-chart-filter-group">
                    <label>Time Range</label>
                    <select
                      className="ad-chart-select"
                      value={chartTimeRange}
                      onChange={(e) => setChartTimeRange(e.target.value)}
                    >
                      <option value="month">This Month</option>
                      <option value="last1">Last 4 Weeks</option>
                      <option value="last3">Last 3 Months</option>
                      <option value="quarter">This Quarter</option>
                      <option value="year">This Year</option>
                    </select>
                  </div>
                  <div className="ad-chart-filter-group">
                    <label>View</label>
                    <select
                      className="ad-chart-select"
                      value={chartView}
                      onChange={(e) => setChartView(e.target.value)}
                    >
                      <option value="category">By Category</option>
                      <option value="subcategory">By Sub-Category</option>
                      <option value="status">By Status</option>
                    </select>
                  </div>
                  {chartView === "subcategory" && (
                    <div className="ad-chart-filter-group">
                      <label>Category</label>
                      <select
                        className="ad-chart-select"
                        value={chartParentCategory}
                        onChange={(e) => setChartParentCategory(e.target.value)}
                      >
                        <option value="Waste Issue">Waste Issue</option>
                        <option value="Drainage Issue">Drainage Issue</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="ad-chart-body">
                <div className="ad-chart-bar">
                  <ResponsiveContainer width="100%" height={220}>
                    {chartView === "category" ? (
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(value, name) => [value, shortenLabel(name)]}
                          contentStyle={{ maxWidth: 200, fontSize: '0.78rem' }}
                        />
                        <Legend iconSize={9} wrapperStyle={{ fontSize: 10.5 }} formatter={(value) => shortenLabel(value)} />
                        <Bar dataKey="Waste Issues" fill={categoryColors["Waste Issue"]} radius={[0, 0, 0, 0]} stackId="a" />
                        <Bar dataKey="Drainage Issues" fill={categoryColors["Drainage Issue"]} radius={[3, 3, 0, 0]} stackId="a" />
                      </BarChart>
                    ) : chartView === "subcategory" ? (
                      <BarChart data={subCategoryChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(value, name) => [value, shortenLabel(name)]}
                          contentStyle={{ maxWidth: 200, fontSize: '0.78rem' }}
                        />
                        <Legend iconSize={9} wrapperStyle={{ fontSize: 10.5 }} />
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
                      <BarChart data={statusByCategoryChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(value, name) => [value, shortenLabel(name)]}
                          contentStyle={{ maxWidth: 200, fontSize: '0.78rem' }}
                        />
                        <Legend iconSize={9} wrapperStyle={{ fontSize: 10.5 }} />
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

                <div className="ad-donut-wrap">
                  {pieTotal === 0 ? (
                    <p className="ad-donut-empty">No reports in this range yet.</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={2}
                          >
                            {pieData.map((entry, i) => (
                              <Cell key={entry.name} fill={pieColors[i % pieColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => [value, shortenLabel(name)]}
                            contentStyle={{ maxWidth: 200, fontSize: '0.78rem' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="ad-donut-legend">
                        {pieData.filter((d) => d.value > 0).map((d, i) => (
                          <div key={d.name} className="ad-donut-legend-item">
                            <span className="ad-donut-dot" style={{ background: pieColors[pieData.indexOf(d) % pieColors.length] }}></span>
                            <span>{d.name}</span>
                            <span className="ad-donut-pct">{Math.round((d.value / pieTotal) * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="ad-overview-right">
              <h3 className="ad-status-title">Top Subcategories — {RANGE_LABELS[chartTimeRange]}</h3>
              {topSubcategoryData.length === 0 ? (
                <p className="ad-donut-empty">No reports in this range yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, topSubcategoryData.length * 34)}>
                  <BarChart
                    data={topSubcategoryData}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                    <Tooltip
                      formatter={(value, name) => [value, shortenLabel(name)]}
                      contentStyle={{ maxWidth: 200, fontSize: '0.78rem' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                      {topSubcategoryData.map((entry) => (
                        <Cell key={entry.name} fill={subcategoryBarColor(entry.category)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Map + chart row — now first */}
          <div className="ad-bottom">
            <div className="ad-map-card">
              <div className="ad-map-header">
                <h3 className="ad-map-title">Report Map</h3>
                <button
                  className="ad-map-fullscreen-btn"
                  onClick={() => {
                    const el = document.getElementById('admin-map-wrapper');
                    if (!document.fullscreenElement) {
                      el.requestFullscreen();
                    } else {
                      document.exitFullscreen();
                    }
                  }}
                >
                  ⛶ Fullscreen
                </button>
              </div>
              <div className="ad-map-content" id="admin-map-wrapper">
                <div className="ad-map-wrapper">
                  <div className="ad-map-search">
                    <span className="ad-map-search-icon"><SearchIcon /></span>
                    <input
                      type="text"
                      className="ad-map-search-input"
                      placeholder="Search Report ID or location..."
                      value={mapSearchQuery}
                      onChange={(e) => setMapSearchQuery(e.target.value)}
                      onKeyDown={handleMapSearch}
                    />
                  </div>

                  <div className="ad-map-filters">
                    <select
                      className="ad-map-filter-select"
                      value={mapFilterStatus}
                      onChange={(e) => setMapFilterStatus(e.target.value)}
                    >
                      <option value="All">All Status</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                    <select
                      className="ad-map-filter-select"
                      value={mapFilterCategory}
                      onChange={(e) => setMapFilterCategory(e.target.value)}
                    >
                      <option value="All">All Categories</option>
                      <option value="Waste Issue">Waste Issue</option>
                      <option value="Drainage Issue">Drainage Issue</option>
                    </select>
                    <select
                      className="ad-map-filter-select"
                      value={mapTimeRange}
                      onChange={(e) => setMapTimeRange(e.target.value)}
                    >
                      <option value="all">All Time</option>
                      <option value="month">This Month</option>
                      <option value="last1">Last 4 Weeks</option>
                      <option value="last3">Last 3 Months</option>
                      <option value="quarter">This Quarter</option>
                      <option value="year">This Year</option>
                    </select>
                  </div>
                  {isLoaded && (
                    <GoogleMap
                      mapContainerStyle={adminMapContainerStyle}
                      center={LUCENA_CENTER}
                      zoom={14}
                      onLoad={onAdminMapLoad}
                      onClick={() => setActiveInfoWindow(null)}
                      options={{
                        zoomControl: false,
                        panControl: false,
                        cameraControl: false,
                        streetViewControl: false,
                        mapTypeControl: false,
                        fullscreenControl: false,
                        rotateControl: false,
                        keyboardShortcuts: false,
                        gestureHandling: 'greedy',
                      }}
                    >
                      {mapMarkers.map((report) => (
                          <MarkerF
                            key={report.id}
                            position={{ lat: report.location.lat, lng: report.location.lng }}
                            icon={getMarkerIcon(statusColors[report.status] || '#e53935')}
                            onClick={() => setActiveInfoWindow(report.id)}
                          >
                            {activeInfoWindow === report.id && (
                              <InfoWindowF
                                position={{ lat: report.location.lat, lng: report.location.lng }}
                                onCloseClick={() => setActiveInfoWindow(null)}
                              >
                                <div className="admin-info-popup" style={{ fontFamily: 'sans-serif', minWidth: '160px', maxWidth: '200px' }}>
                                  <p style={{ fontWeight: 700, color: '#1a4a1a', marginBottom: 4 }}>
                                    #{report.reportId || report.id.slice(0, 6).toUpperCase()}
                                  </p>
                                  <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: 2 }}>
                                    {report.fullName || "—"}
                                  </p>
                                  {report.email && (
                                    <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>
                                      {report.email}
                                    </p>
                                  )}
                                  <p style={{ fontSize: '0.82rem', color: '#555', marginBottom: 2 }}>
                                    {report.category}
                                  </p>
                                  <p style={{ fontSize: '0.78rem', color: '#777', marginBottom: 4 }}>
                                    {report.subCategory === "Other"
                                      ? (report.subCategoryOther || "Other")
                                      : (report.subCategory || "—")}
                                  </p>
                                  <p style={{ fontSize: '0.78rem', color: '#888', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <CalendarIcon /> {formatDate(report.createdAt)}
                                  </p>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '3px 10px',
                                    borderRadius: 20,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: 'white',
                                    background: statusColors[report.status] || '#e53935',
                                    marginBottom: 4,
                                  }}>
                                    {report.status || 'Pending'}
                                  </span>
                                  {report.description && (
                                    <p style={{ fontSize: '0.78rem', color: '#555', marginTop: 4, borderTop: '1px solid #eee', paddingTop: 4 }}>
                                      {report.description}
                                    </p>
                                  )}
                                  {(report.locationDescription || report.addressInput || addresses[report.id]) && (
                                    <p style={{ fontSize: '0.78rem', color: '#666', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <PinIcon /> {report.locationDescription || report.addressInput || addresses[report.id]}
                                    </p>
                                  )}
                                  {report.assignedTo && (
                                    <p style={{ fontSize: '0.78rem', color: '#666', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <BuildingIcon /> {report.assignedTo}
                                    </p>
                                  )}
                                  {report.photo && (
                                    <img src={report.photo} alt="Report" style={{ width: '100%', borderRadius: 6, marginTop: 6 }} />
                                  )}
                                  <button
                                    onClick={() => navigate(`/admin/reports?report=${report.id}`)}
                                    style={{
                                      display: 'block',
                                      width: '100%',
                                      marginTop: 8,
                                      padding: '6px 10px',
                                      background: '#1a4a1a',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: 6,
                                      fontSize: '0.78rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      fontFamily: 'sans-serif',
                                    }}
                                  >
                                    Manage This Report →
                                  </button>
                                </div>
                              </InfoWindowF>
                            )}
                          </MarkerF>
                        ))}
                    </GoogleMap>
                  )}

                  <div className="ad-map-legend">
                    {Object.entries(statusColors).map(([status, color]) => (
                      <div key={status} className="ad-legend-item">
                        <span className="ad-legend-dot" style={{ background: color }}></span>
                        <span className="ad-legend-label">{status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ad-map-sidebar">
                  <div className="ad-sidebar-header">
                    Reports ({mapMarkers.length})
                  </div>
                  {mapMarkers.length === 0 ? (
                    <p className="ad-sidebar-empty">No reports match the current filters.</p>
                  ) : (
                    [...mapMarkers]
                      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
                      .map((report) => (
                        <div
                          key={report.id}
                          className={`ad-sidebar-item ${activeInfoWindow === report.id ? 'ad-sidebar-item--active' : ''}`}
                          onClick={() => panToReport(report)}
                        >
                          <div className="ad-sidebar-item-top">
                            <span className="ad-sidebar-item-id">
                              #{report.reportId || report.id.slice(0, 6).toUpperCase()}
                            </span>
                            <span className={getStatusClass(report.status)}>
                              {report.status || "Pending"}
                            </span>
                          </div>
                          <div className="ad-sidebar-item-cat">
                            {report.category}
                            {report.subCategory && (
                              <span className="ad-sidebar-item-sub">
                                {" · "}
                                {report.subCategory === "Other" ? (report.subCategoryOther || "Other") : report.subCategory}
                              </span>
                            )}
                          </div>
                          <div className="ad-sidebar-item-date">{formatDate(report.createdAt)}</div>
                            <button
                              className="ad-sidebar-manage-btn"
                              onClick={(e) => {
                                e.stopPropagation(); // para hindi din ma-trigger ang panToReport
                                navigate(`/admin/reports?report=${report.id}`);
                              }}
                            >
                              Manage →
                            </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recent reports table */}
          <div className="ad-table-card">
            <div className="ad-table-header">
              <h3 className="ad-table-title">Recent Reports</h3>
              <button
                className="ad-view-all"
                onClick={() => navigate("/admin/reports")}
              >
                View all →
              </button>
            </div>
            <table className="ad-table">
              <colgroup>
                <col style={{ width: "8%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "9%" }} />
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
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan="10" className="ad-empty">No reports yet.</td></tr>
                ) : (
                  recent.map((r) => (
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
        </>
      )}
    </AdminLayout>
  );
}