import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../logowhite2.png';
import './About.css';
import '../../styles/CitizenHeader.css';

function About() {
  const navigate = useNavigate();

  return (
    <div className="about-container">
      {/* Header */}
      <div className="citizen-header">
        <div className="header-logo">
          <img src={logo} alt="CityEcoMap" className="logo-img" />
        </div>
        <nav className="header-nav">
          <a href="/map" className="nav-link">Home</a>
          <a href="/track-report" className="nav-link">Track Report</a>
          <a href="/about" className="nav-link active">About</a>
        </nav>
      </div>

      {/* Hero */}
      <div className="about-hero">
        <h2 className="about-title">ABOUT CITYECOMAP</h2>
        <p className="about-subtitle">A Geo-Tagged Mobile and Web Monitoring and Reporting System for Environmental Waste and Drainage Issues</p>
      </div>

      {/* Body */}
      <div className="about-body">

        {/* What is CityEcoMap */}
        <div className="about-section">
          <div className="section-icon">🌿</div>
          <div className="section-content">
            <h3>What is CityEcoMap?</h3>
            <p>CityEcoMap is a mobile and web-based environmental monitoring and reporting system developed for Lucena City. It enables residents to report waste and drainage issues using geo-tagged data, photos, and descriptions, while the Environmental Management Bureau (EMB) of the DENR and the Local Government of Lucena City monitor, verify, and respond to these reports.</p>
          </div>
        </div>

        <div className="divider" />

        {/* How it works */}
        <div className="about-section">
          <div className="section-icon">⚙️</div>
          <div className="section-content">
            <h3>How It Works</h3>
            <div className="steps-grid">
              <div className="step-box">
                <span className="step-number">1</span>
                <span className="step-icon">📍</span>
                <strong>Report</strong>
                <p>Submit a waste or drainage issue with a photo, description, your GPS location, and an optional note to help pinpoint the exact spot.</p>
              </div>
              <div className="step-box">
                <span className="step-number">2</span>
                <span className="step-icon">🔔</span>
                <strong>Notify</strong>
                <p>Our team is notified in real-time and reviews your report. Add your email (optional) to get status updates directly.</p>
              </div>
              <div className="step-box">
                <span className="step-number">3</span>
                <span className="step-icon">📋</span>
                <strong>Track</strong>
                <p>Use your Report ID to monitor the status of your report anytime.</p>
              </div>
              <div className="step-box">
                <span className="step-number">4</span>
                <span className="step-icon">✅</span>
                <strong>Resolve</strong>
                <p>EMB or LGU resolves the issue based on its type, keeping the community informed.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Report Categories */}
        <div className="about-section">
          <div className="section-icon">📂</div>
          <div className="section-content">
            <h3>Report Categories</h3>
            <div className="category-grid">
              <div className="category-box">
                <span className="cat-icon">🗑️</span>
                <strong>Waste Issue</strong>
                <p>Report illegal dumping, uncollected garbage, or waste affecting rivers, waterways, and natural water bodies in your area.</p>
              </div>
              <div className="category-box">
                <span className="cat-icon">🌊</span>
                <strong>Drainage Issue</strong>
                <p>Report drainage problems or flooding caused by blocked or damaged drainage systems in your area.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Who We Work With */}
        <div className="about-section">
          <div className="section-icon">🏛️</div>
          <div className="section-content">
            <h3>Who We Work With</h3>
            <p>CityEcoMap is developed for the <strong>Environmental Management Bureau (EMB) of the DENR</strong>, the agency responsible for monitoring and responding to environmental concerns, in coordination with the <strong>Local Government of Lucena City</strong>, which oversees local drainage and waste management operations within the city.</p>
          </div>
        </div>

        {/* CTA */}
        <div className="about-cta">
          <h3>Ready to make a difference?</h3>
          <p>Report an environmental issue in your community today.</p>
          <button className="cta-btn" onClick={() => navigate('/submit-report')}>
            + Submit a Report
          </button>
        </div>

      </div>

      {/* Bottom Nav - Mobile Only */}
      <div className="bottom-nav">
        <a href="/map" className="bottom-nav-item">
          <span>🏠</span>
          <span>Home</span>
        </a>
        <a href="/track-report" className="bottom-nav-item">
          <span>📋</span>
          <span>Track Report</span>
        </a>
        <a href="/about" className="bottom-nav-item active">
          <span>ℹ️</span>
          <span>About</span>
        </a>
      </div>
    </div>
  );
}

export default About;