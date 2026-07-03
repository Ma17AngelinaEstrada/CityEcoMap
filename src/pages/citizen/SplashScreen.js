import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../logogreen2.png';
import './SplashScreen.css';

function SplashScreen() {
  const navigate = useNavigate();

  return (
    <div className="splash-container">
      <div className="splash-hero">
        <img src={logo} alt="CityEcoMap Logo" className="splash-logo" />
      </div>

      <div className="splash-sheet">
        <div className="splash-sheet-handle"></div>

        <h1 className="splash-title">Together for a Cleaner,<br />Greener City</h1>
        <p className="splash-subtitle">
          Report waste and drainage issues in your area to help build a better community.
        </p>

        <div className="splash-owner">
          <span className="splash-owner-label">DEVELOPED FOR</span>
          <p className="splash-owner-names">
            Environmental Management Bureau (EMB) &amp; the Local Government of Lucena City
          </p>
        </div>

        <div className="splash-notices">
          <div className="splash-notice-item">
            <span className="splash-notice-icon">📍</span>
            <p>We'll ask for your location when submitting a report, so it can be pinned accurately on the map.</p>
          </div>
          <div className="splash-notice-item">
            <span className="splash-notice-icon">📱</span>
            <p>Submitting a report works best on mobile devices with camera and GPS access.</p>
          </div>
        </div>

        <button className="splash-button" onClick={() => navigate('/map')}>
          Get Started
        </button>
      </div>
    </div>
  );
}

export default SplashScreen;