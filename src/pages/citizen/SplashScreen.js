import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../logogreen2.png';
import './SplashScreen.css';

function SplashScreen() {
  const navigate = useNavigate();

  return (
    <div className="splash-container">
      <div className="splash-content">
        <img src={logo} alt="CityEcoMap Logo" className="splash-logo" />
        <h1 className="splash-title">Together for a Cleaner,<br />Greener City</h1>
        <p className="splash-subtitle">
          Report waste and drainage issues in your area to help build a better community.
        </p>
      </div>
      <button className="splash-button" onClick={() => navigate('/map')}>
        Get Started
      </button>
    </div>
  );
}

export default SplashScreen;