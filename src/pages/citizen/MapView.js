import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import logo from '../../logowhite2.png';
import './MapView.css';
import '../../styles/CitizenHeader.css';
import { SearchIcon, CalendarIcon, PinIcon, BuildingIcon, HomeIcon, TrackIcon, AboutIcon } from '../../components/Icons';
import { useGoogleMapsLoaded } from '../../context/GoogleMapsLoaderContext';
import OnboardingTour from '../../components/OnboardingTour';

const statusColors = {
  'Pending':  '#e53935',
  'Approved': '#1565c0',
  'Ongoing':  '#f9a825',
  'Resolved': '#2e7d32',
  'Rejected': '#757575',
};

const LUCENA_CENTER = { lat: 13.9394, lng: 121.6169 };

const mapContainerStyle = { width: '100%', height: '100%' };

function MapView() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);
  const mapRef = useRef(null);
  const routerLocation = useLocation();
  const flyToCoords = routerLocation.state?.flyTo;
  const flyToId = routerLocation.state?.flyToId;
  const [pendingFlyTo, setPendingFlyTo] = useState(flyToCoords || null);
  const [heading, setHeading] = useState(0);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [activeReportsTab, setActiveReportsTab] = useState('recent'); // 'mine' | 'recent'
  const [myReportIds, setMyReportIds] = useState([]);
  const { isLoaded } = useGoogleMapsLoaded();
  const [showTour, setShowTour] = useState(routerLocation.state?.showTour || false);

    const TOUR_STEPS = [
    {
      selector: '.floating-search',
      title: 'Search a Location',
      description: 'Type an address here to jump the map straight to that spot.',
      static: true,
    },
    {
      selector: '.floating-filters',
      title: 'Filter Reports',
      description: 'Narrow down what you see on the map by category or status.',
      static: true,
    },
    {
      selector: '.locate-btn',
      title: 'Find Your Location',
      description: 'Tap this to center the map on where you are right now.',
      static: true,
    },
    {
      selector: '.map-legend',
      title: 'Map Legend',
      description: 'The blue arrow shows where you are. The colored dots show report statuses.',
      static: true,
    },
    {
      selector: '.fab-btn',
      title: 'Submit a Report',
      description: 'Tap here anytime to report a waste or drainage issue in your area.',
      static: true,
    },
    {
      selector: '.reports-panel-handle',
      title: 'Recent Reports',
      description: 'Tap this bar to see recent reports and your own submitted reports.',
    },
    {
      selector: '.bottom-nav',
      title: 'Navigation Menu',
      description: 'Use these buttons to go Home, Track your Report, or view the About page anytime.',
    },
  ];

  useEffect(() => {
    if (showTour) setPanelExpanded(true);
  }, [showTour]);

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
      mapRef.current.panTo({ lat: pendingFlyTo.lat, lng: pendingFlyTo.lng });
      mapRef.current.setZoom(17);

      const targetReport = reports.find((r) => r.reportId === flyToId);
      if (targetReport) {
        setTimeout(() => {
          setActiveInfoWindow(targetReport.id);
        }, 800);
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
        mapRef.current?.panTo({ lat: parseFloat(lat), lng: parseFloat(lon) });
        mapRef.current?.setZoom(16);
      } else {
        alert('Location not found. Try a more specific address.');
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
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

  const startCompass = () => {
    const handleOrientation = (event) => {
      let compassHeading;
      if (event.webkitCompassHeading !== undefined) {
        compassHeading = event.webkitCompassHeading; // iOS
      } else if (event.alpha !== null) {
        compassHeading = 360 - event.alpha; // Android
      }
      if (compassHeading !== undefined) {
        setHeading(compassHeading);
      }
    };

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then((response) => {
          if (response === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          }
        })
        .catch(console.error);
    } else if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    } else {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
  };

  const [userLocation, setUserLocation] = useState(null);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Location services are not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(coords);
        mapRef.current?.panTo(coords);
        mapRef.current?.setZoom(16);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please make sure location access is allowed.');
      },
      { enableHighAccuracy: true }
    );
    startCompass();
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(coords);
        mapRef.current?.panTo(coords);
        mapRef.current?.setZoom(16);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please make sure location access is allowed.');
      },
      { enableHighAccuracy: true }
    )
  };

  useEffect(() => {
    if (!isLoaded || !navigator.geolocation) return;
    startCompass();
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(coords);
        mapRef.current?.panTo(coords);
        mapRef.current?.setZoom(16);
      },
      (error) => {
        console.error('Auto-locate failed:', error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [isLoaded]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('cityecomap_my_reports') || '[]');
    setMyReportIds(saved.map((r) => r.reportId));
  }, []);

  const myReports = reports
    .filter((r) => myReportIds.includes(r.reportId))
    .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

  const recentReports = [...reports]
    .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
    .slice(0, 6);

  const handleReportCardClick = (report) => {
    if (!report.location?.lat || !report.location?.lng) return;
    mapRef.current?.panTo({ lat: report.location.lat, lng: report.location.lng });
    mapRef.current?.setZoom(17);
    setActiveInfoWindow(report.id);
  };

  return (
    <div className="map-container">

      {/* Top Navigation Bar */}
      <div className="citizen-header">
        <div className="header-logo">
          <img src={logo} alt="CityEcoMap Logo" className="logo-img" />
        </div>
        <div className="header-right">
          <nav className="header-nav">
            <a href="/map" className="nav-link active">Home</a>
            <a href="/track-report" className="nav-link">Track Report</a>
            <a href="/about" className="nav-link">About</a>
          </nav>
          <button
            className="header-help-btn"
            onClick={() => { setPanelExpanded(true); setShowTour(true); }}
            title="Show guide"
          >
            ?
          </button>
        </div>
      </div>

      {/* Map Area */}
      <div className="map-area">
        {isLoaded && (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={LUCENA_CENTER}
            zoom={14}
            onLoad={onMapLoad}
            onClick={() => setActiveInfoWindow(null)}
            options={{
              zoomControl: false,
              panControl: false,
              cameraControl: false,
              zoomControlOptions: { position: window.google.maps.ControlPosition.TOP_RIGHT },
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              rotateControl: false,
              keyboardShortcuts: false,
              gestureHandling: 'greedy',
            }}
          >
            {filtered.map((report) => (
              <MarkerF
                key={report.id}
                position={{ lat: report.location.lat, lng: report.location.lng }}
                icon={getMarkerIcon(statusColors[report.status] || '#e53935')}
                onClick={() => setActiveInfoWindow(report.id)}
              >
                {activeInfoWindow === report.id && (
                  <InfoWindowF onCloseClick={() => setActiveInfoWindow(null)}>
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
                  </InfoWindowF>
                )}
              </MarkerF>
            ))}
            {userLocation && (
              <MarkerF
                position={userLocation}
                icon={{
                  path: 'M 0,-10 L 7,8 L 0,4 L -7,8 Z',
                  fillColor: '#4285F4',
                  fillOpacity: 1,
                  strokeColor: 'white',
                  strokeWeight: 2,
                  scale: 1.4,
                  rotation: heading,
                  anchor: new window.google.maps.Point(0, 0),
                }}
                zIndex={999}
              />
            )}
          </GoogleMap>
        )}

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

        <button className="locate-btn" onClick={handleLocateMe} title="Show my location">
          📍
        </button>

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
          <div className="legend-item">
            <span className="legend-arrow"></span>
            <span className="legend-label">You</span>
          </div>
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
          <span>Submit a Report</span>
        </button>
      </div>

      {/* Collapsible Reports Panel */}
      <div className={`reports-panel ${panelExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="reports-panel-handle" onClick={() => setPanelExpanded(!panelExpanded)}>
          <span className="handle-bar"></span>
          <span className="handle-label">{panelExpanded ? 'Hide Reports ▾' : 'Show Reports ▴'}</span>
        </div>

        <div className="reports-panel-content">
          {myReports.length > 0 && (
            <div className="report-tabs">
              <button
                className={`report-tab ${activeReportsTab === 'mine' ? 'report-tab--active' : ''}`}
                onClick={() => setActiveReportsTab('mine')}
              >
                My Reports
              </button>
              <button
                className={`report-tab ${activeReportsTab === 'recent' ? 'report-tab--active' : ''}`}
                onClick={() => setActiveReportsTab('recent')}
              >
                Recent Reports
              </button>
            </div>
          )}

          {(activeReportsTab === 'mine' && myReports.length > 0) && (
            <div className="report-section">
              <div className="report-cards-scroll">
                {myReports.map((r) => (
                  <div 
                  key={r.id} 
                  className="report-mini-card" 
                  style={{ borderLeftColor: statusColors[r.status] || '#e53935' }}
                  onClick={() => handleReportCardClick(r)}>
                    <span
                      className="report-mini-status"
                      style={{ background: statusColors[r.status] || '#e53935' }}
                    >
                      {r.status || 'Pending'}
                    </span>
                    <p className="report-mini-id">#{r.reportId}</p>
                    <p className="report-mini-category">{r.category}{r.subCategory ? ` — ${r.subCategory}` : ''}</p>
                    <p className="report-mini-date">{formatDate(r.createdAt)}</p>
                    {r.description && (
                      <p className="report-mini-desc">
                        {r.description.length > 60 ? r.description.slice(0, 60) + '...' : r.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeReportsTab === 'recent' || myReports.length === 0) && (
            <div className="report-section">
              {myReports.length === 0 && <h3 className="report-section-title">Recent Reports</h3>}
              <div className="report-cards-scroll">
                {recentReports.length === 0 ? (
                  <p className="report-empty">No reports yet.</p>
                ) : (
                  recentReports.map((r) => (
                    <div 
                    key={r.id} 
                    className="report-mini-card" 
                    style={{ borderLeftColor: statusColors[r.status] || '#e53935' }}
                    onClick={() => handleReportCardClick(r)}>
                      <span
                        className="report-mini-status"
                        style={{ background: statusColors[r.status] || '#e53935' }}
                      >
                        {r.status || 'Pending'}
                      </span>
                      <p className="report-mini-id">#{r.reportId || r.id.slice(0, 6).toUpperCase()}</p>
                      <p className="report-mini-category">{r.category}{r.subCategory ? ` — ${r.subCategory}` : ''}</p>
                      <p className="report-mini-date">{formatDate(r.createdAt)}</p>
                      {r.description && (
                        <p className="report-mini-desc">
                          {r.description.length > 60 ? r.description.slice(0, 60) + '...' : r.description}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
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
      {showTour && (
        <OnboardingTour steps={TOUR_STEPS} onFinish={() => setShowTour(false)} />
      )}
    </div>
  );
}

export default MapView;