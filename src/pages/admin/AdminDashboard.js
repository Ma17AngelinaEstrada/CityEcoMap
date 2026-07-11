import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";
import AdminLayout from "./AdminLayout";
import "./AdminDashboard.css";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { reverseGeocode } from '../../utils/geocode';
import { SearchIcon, CalendarIcon, PinIcon, BuildingIcon } from '../../components/Icons';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const createIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="
    width: 14px; height: 14px;
    background: ${color};
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
});

const statusColors = {
  'Pending':  '#e53935',
  'Approved': '#1565c0',
  'Ongoing':  '#f9a825',
  'Resolved': '#2e7d32',
  'Rejected': '#757575',
};

const LUCENA_CENTER = [13.9394, 121.6169];

function AdminMapController({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const adminMapRef = useRef(null);
  const adminMarkerRefs = useRef({});

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

  const total = reports.length;
  const pending = reports.filter((r) => r.status === "Pending").length;
  const approved = reports.filter((r) => r.status === "Approved").length;
  const ongoing = reports.filter((r) => r.status === "Ongoing" || r.status === "In Progress").length;
  const resolved = reports.filter((r) => r.status === "Resolved").length;
  const rejected = reports.filter((r) => r.status === "Rejected").length;

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const currentYear = new Date().getFullYear();
  const chartData = monthNames.map((month, i) => {
    const waste = reports.filter((r) => {
      const date = r.createdAt?.toDate?.();
      return date && date.getMonth() === i && date.getFullYear() === currentYear && r.category === "Waste Issue";
    }).length;
    const drainage = reports.filter((r) => {
      const date = r.createdAt?.toDate?.();
      return date && date.getMonth() === i && date.getFullYear() === currentYear && r.category === "Drainage Issue";
    }).length;
    return { month, "Waste Issues": waste, "Drainage Issues": drainage };
  });

  const recent = [...reports]
    .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
    .slice(0, 7);

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

  const handleMapSearch = async (e) => {
    if (e.key !== 'Enter') return;
    if (!mapSearchQuery.trim()) return;

    // Check if it looks like a Report ID first
    const cleanQuery = mapSearchQuery.trim().replace('#', '').toUpperCase();
    const matchedReport = reports.find(
      (r) => r.reportId?.toUpperCase() === cleanQuery
    );

    if (matchedReport && matchedReport.location?.lat && matchedReport.location?.lng) {
      adminMapRef.current?.flyTo(
        [matchedReport.location.lat, matchedReport.location.lng],
        17,
        { duration: 1.5 }
      );
      setTimeout(() => {
        const marker = adminMarkerRefs.current[matchedReport.id];
        if (marker) marker.openPopup();
      }, 1600);
      return;
    }

    // Otherwise treat as a location search
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapSearchQuery)}&format=json&limit=1&countrycodes=ph`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        adminMapRef.current?.flyTo([parseFloat(lat), parseFloat(lon)], 16, { duration: 1.5 });
      } else {
        alert('No matching report or location found.');
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  return (
    <AdminLayout>
      {loading ? (
        <p className="ad-loading">Loading reports...</p>
      ) : (
        <>
          {/* 6 Stat cards */}
          <div className="ad-stats">
            <div className="ad-stat-card">
              <span className="ad-stat-label">Total Reports</span>
              <span className="ad-stat-number">{total}</span>
            </div>
            <div className="ad-stat-card ad-stat-card--pending">
              <span className="ad-stat-label">Pending</span>
              <span className="ad-stat-number">{pending}</span>
            </div>
            <div className="ad-stat-card ad-stat-card--approved">
              <span className="ad-stat-label">Approved</span>
              <span className="ad-stat-number">{approved}</span>
            </div>
            <div className="ad-stat-card ad-stat-card--ongoing">
              <span className="ad-stat-label">Ongoing</span>
              <span className="ad-stat-number">{ongoing}</span>
            </div>
            <div className="ad-stat-card ad-stat-card--resolved">
              <span className="ad-stat-label">Resolved</span>
              <span className="ad-stat-number">{resolved}</span>
            </div>
            <div className="ad-stat-card ad-stat-card--rejected">
              <span className="ad-stat-label">Rejected</span>
              <span className="ad-stat-number">{rejected}</span>
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
                {recent.length === 0 ? (
                  <tr><td colSpan="5" className="ad-empty">No reports yet.</td></tr>
                ) : (
                  recent.map((r) => (
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

          {/* Bottom row: map + chart */}
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
              <div className="ad-map-wrapper" id="admin-map-wrapper">
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
                <MapContainer
                  center={LUCENA_CENTER}
                  zoom={14}
                  style={{ width: '100%', height: '100%' }}
                  zoomControl={true}
                >
                  <AdminMapController mapRef={adminMapRef} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {reports
                    .filter((r) => r.location?.lat && r.location?.lng)
                    .map((report) => (
                      <Marker
                        key={report.id}
                        position={[report.location.lat, report.location.lng]}
                        icon={createIcon(statusColors[report.status] || '#e53935')}
                        ref={(el) => {
                          if (el) adminMarkerRefs.current[report.id] = el;
                        }}
                      >
                      <Popup>
                        <div style={{ fontFamily: 'sans-serif', minWidth: '160px', maxWidth: '200px' }}>
                          <p style={{ fontWeight: 700, color: '#1a4a1a', marginBottom: 4 }}>
                            #{report.reportId || report.id.slice(0, 6).toUpperCase()}
                          </p>
                          <p style={{ fontSize: '0.82rem', color: '#555', marginBottom: 4 }}>
                            {report.category}
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
                          {(report.locationDescription || addresses[report.id]) && (
                            <p style={{ fontSize: '0.78rem', color: '#666', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <PinIcon /> {report.locationDescription || addresses[report.id]}
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
                        </div>
                      </Popup>
                      </Marker>
                    ))}
                </MapContainer>

                <div className="ad-map-legend">
                  {Object.entries(statusColors).map(([status, color]) => (
                    <div key={status} className="ad-legend-item">
                      <span className="ad-legend-dot" style={{ background: color }}></span>
                      <span className="ad-legend-label">{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ad-chart-card">
              <h3 className="ad-chart-title">Report Statistics — {currentYear}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
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