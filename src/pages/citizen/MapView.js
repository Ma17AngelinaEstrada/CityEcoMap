import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import logo from '../../logowhite2.png';
import './MapView.css';

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

function MapView() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reports'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setReports(data);
    });
    return () => unsub();
  }, []);

  const filtered = reports.filter((r) => {
    const hasLocation = r.location?.lat && r.location?.lng;
    const matchCategory = filterCategory === 'All' || r.category === filterCategory;
    const matchStatus = filterStatus === 'All' || r.status === filterStatus;
    return hasLocation && matchCategory && matchStatus;
  });

  const formatDate = (ts) => {
    if (!ts) return '—';
    const date = ts.toDate?.();
    if (!date) return '—';
    return date.toLocaleDateString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  return (
    <div className="map-container">

      {/* Top Navigation Bar */}
      <div className="map-header">
        <div className="header-logo">
          <img src={logo} alt="CityEcoMap Logo" className="logo-img" />
        </div>
        <nav className="header-nav">
          <a href="/map" className="nav-link active">Home</a>
          <a href="/track-report" className="nav-link">Track Report</a>
          <a href="/about" className="nav-link">About</a>
        </nav>
      </div>

      {/* Map Area */}
      <div className="map-area">
        <MapContainer
          center={LUCENA_CENTER}
          zoom={14}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filtered.map((report) => (
            <Marker
              key={report.id}
              position={[report.location.lat, report.location.lng]}
              icon={createIcon(statusColors[report.status] || '#e53935')}
            >
              <Popup>
                <div className="map-popup">
                  <p className="popup-id">#{report.reportId || report.id.slice(0, 6).toUpperCase()}</p>
                  <p className="popup-type">{report.category}</p>
                  <p className="popup-date">📅 {formatDate(report.createdAt)}</p>
                  <span
                    className="popup-status"
                    style={{ background: statusColors[report.status] || '#e53935' }}
                  >
                    {report.status || 'Pending'}
                  </span>
                  {report.description && (
                    <p className="popup-desc">{report.description}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Search Bar */}
        <div className="floating-search">
          <input
            type="text"
            className="search-bar"
            placeholder="🔍 Search location..."
          />
        </div>

        {/* Floating Filters */}
        <div className="floating-filters">
          <select
            className="filter-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Waste Issue">Waste Issue</option>
            <option value="Drainage Issue">Drainage Issue</option>
          </select>
          <select
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>

        {/* Legend */}
        <div className="map-legend">
          {Object.entries(statusColors)
            .filter(([s]) => s !== 'Rejected')
            .map(([status, color]) => (
              <div key={status} className="legend-item">
                <span className="legend-dot" style={{ background: color }}></span>
                <span className="legend-label">{status}</span>
              </div>
            ))}
        </div>

        {/* Floating Submit Button */}
        <button className="fab-btn" onClick={() => navigate('/submit-report')}>
          <span className="fab-text">+ Submit Report</span>
          <span className="fab-icon">+</span>
        </button>
      </div>

      {/* Bottom Nav - Mobile Only */}
      <div className="bottom-nav">
        <a href="/map" className="bottom-nav-item active">
          <span>🏠</span>
          <span>Home</span>
        </a>
        <a href="/track-report" className="bottom-nav-item">
          <span>📋</span>
          <span>Track Report</span>
        </a>
        <a href="/about" className="bottom-nav-item">
          <span>ℹ️</span>
          <span>About</span>
        </a>
      </div>

    </div>
  );
}

export default MapView;