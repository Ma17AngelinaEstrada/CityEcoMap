import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import logo from '../../logowhite2.png';
import './MapView.css';
import '../../styles/CitizenHeader.css';
import { SearchIcon, CalendarIcon, PinIcon, BuildingIcon, PlusIcon, HomeIcon, TrackIcon, AboutIcon } from '../../components/Icons';


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

function MapController({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

function MapView() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef(null);
  const routerLocation = useLocation();
  const flyToCoords = routerLocation.state?.flyTo;
  const flyToId = routerLocation.state?.flyToId;
  const [pendingFlyTo, setPendingFlyTo] = useState(flyToCoords || null);

  const markerRefs = useRef({});

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

  useEffect(() => {
    if (pendingFlyTo && mapRef.current && reports.length > 0) {
      mapRef.current.flyTo([pendingFlyTo.lat, pendingFlyTo.lng], 17, { duration: 1.5 });

      // Find the matching report and open its popup after flying
      const targetReport = reports.find((r) => r.reportId === flyToId);
      if (targetReport) {
        setTimeout(() => {
          const marker = markerRefs.current[targetReport.id];
          if (marker) marker.openPopup();
        }, 1600);
      }
      setPendingFlyTo(null);
    }
  }, [pendingFlyTo, reports, flyToId]);

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

  const handleSearch = async (e) => {
    if (e.key !== 'Enter') return;
    if (!searchQuery.trim()) return;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&countrycodes=ph`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        mapRef.current?.setView([parseFloat(lat), parseFloat(lon)], 16);
      } else {
        alert('Location not found. Try a more specific address.');
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  return (
    <div className="map-container">

      {/* Top Navigation Bar */}
      <div className="citizen-header">
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
          <MapController mapRef={mapRef} />
          {filtered.map((report) => (
            <Marker
              key={report.id}
              position={[report.location.lat, report.location.lng]}
              icon={createIcon(statusColors[report.status] || '#e53935')}
              ref={(el) => {
                if (el) markerRefs.current[report.id] = el;
              }}
            >
              <Popup>
                <div className="map-popup">
                  <p className="popup-id">#{report.reportId || report.id.slice(0, 6).toUpperCase()}</p>
                  <p className="popup-type">{report.category}</p>
                  <p className="popup-date"><CalendarIcon /> {formatDate(report.createdAt)}</p>
                  <span
                    className="popup-status"
                    style={{ background: statusColors[report.status] || '#e53935' }}
                  >
                    {report.status || 'Pending'}
                  </span>
                  {report.description && (
                    <p className="popup-desc">{report.description}</p>
                  )}
                  {report.locationDescription && (
                    <p className="popup-location"><PinIcon /> {report.locationDescription}</p>
                  )}
                  {report.assignedTo && (
                    <p className="popup-assigned"><BuildingIcon /> Assigned to: {report.assignedTo}</p>
                  )}
                  {report.photo && (
                    <img src={report.photo} alt="Report" className="popup-photo" />
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Search Bar */}
        <div className="floating-search">
          <span className="search-icon"><SearchIcon /></span>
          <input
            type="text"
            className="search-bar"
            placeholder="Search location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
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
          <span className="fab-icon"><PlusIcon /></span>
        </button>
      </div>

      {/* Bottom Nav - Mobile Only */}
      <div className="bottom-nav">
        <a href="/map" className="bottom-nav-item active">
          <span className="nav-icon"><HomeIcon /></span>
          <span>Home</span>
        </a>
        <a href="/track-report" className="bottom-nav-item">
          <span className="nav-icon"><TrackIcon /></span>
          <span>Track Report</span>
        </a>
        <a href="/about" className="bottom-nav-item">
          <span className="nav-icon"><AboutIcon /></span>
          <span>About</span>
        </a>
      </div>

    </div>
  );
}

export default MapView;