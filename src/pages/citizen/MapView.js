import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../logowhite2.png';
import './MapView.css';

function MapView() {
  const navigate = useNavigate();

  return (
    <div className="map-container">

      {/* Top Navigation Bar */}
      <div className="map-header">
        <div className="header-logo">
          <img src={logo} alt="CityEcoMap Logo" className="logo-img" />
        </div>
        <nav className="header-nav">
          <a href="/" className="nav-link active">Home</a>
          <a href="/track-report" className="nav-link">Track Report</a>
          <a href="/about" className="nav-link">About</a>
        </nav>
      </div>

      {/* Map Area with floating elements */}
      <div className="map-area">

        {/* Map placeholder */}
        <div className="map-placeholder">
          <p>🗺️ Map View</p>
          <p className="map-note">Google Maps will load here</p>
        </div>

        {/* Floating Search Bar */}
        <div className="floating-search">
          <input
            type="text"
            className="search-bar"
            placeholder="🔍 Search location..."
          />
        </div>

        {/* Floating Submit Button */}
        <button className="fab-btn" onClick={() => navigate('/submit-report')}>
          <span className="fab-text">+ Submit Report</span>
          <span className="fab-icon">+</span>
        </button>

      </div>

      {/* Bottom Nav - Mobile Only */}
      <div className="bottom-nav">
        <a href="/" className="bottom-nav-item active">
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