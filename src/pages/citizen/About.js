import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../logowhite2.png';

import './About.css';
import '../../styles/CitizenHeader.css';
import { LeafIcon, GearIcon, FolderIcon, BankIcon, TrashIcon, WaveIcon, PinIcon, BellIcon, ClipboardIcon, CheckCircleIcon, HomeIcon, TrackIcon, AboutIcon } from '../../components/Icons';

function About() {
  const navigate = useNavigate();

  return (
    <div className="about-container">
      {/* Header */}
      <div className="citizen-header">
        <div className="header-logo">
          <img src={logo} alt="CityEcoMap Logo" className="logo-img" />
        </div>
        <div className="header-right">
          <nav className="header-nav">
            <a href="/map" className="nav-link">Home</a>
            <a href="/track-report" className="nav-link">Track Report</a>
            <a href="/about" className="nav-link active">About</a>
          </nav>
        </div>
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
          <div className="section-icon"><LeafIcon /></div>
          <div className="section-content">
            <h3>What is CityEcoMap?</h3>
            <p>CityEcoMap enables residents to report waste and drainage concerns in Lucena City. Submitted reports are directed to the appropriate city offices for validation, monitoring, and resolution. The Environmental Management Bureau (EMB) has read-only monitoring access to the system.</p>
          </div>
        </div>

        <div className="divider" />

        {/* How it works */}
        <div className="about-section" id="about-how-it-works">
          <div className="section-icon"><GearIcon /></div>
          <div className="section-content">
            <h3>How It Works</h3>
            <div className="steps-grid">
              <div className="step-box">
                <span className="step-number">1</span>
                <span className="step-icon"><PinIcon /></span>
                <strong>Report</strong>
                <p>Submit a waste or drainage issue with a photo, description, your GPS location, and an optional note to help pinpoint the exact spot.</p>
              </div>
              <div className="step-box">
                <span className="step-number">2</span>
                <span className="step-icon"><BellIcon /></span>
                <strong>Notify</strong>
                <p>Our team is notified in real-time and reviews your report. Add your email (optional) to get status updates directly.</p>
              </div>
              <div className="step-box">
                <span className="step-number">3</span>
                <span className="step-icon"><ClipboardIcon /></span>
                <strong>Track</strong>
                <p>Use your Report ID to monitor the status of your report anytime.</p>
              </div>
              <div className="step-box">
                <span className="step-number">4</span>
                <span className="step-icon"><CheckCircleIcon /></span>
                <strong>Resolve</strong>
                <p>The concerned city office (City ENRO or City Engineering Office) reviews and resolves the reported issue based on its type.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Report Categories */}
        <div className="about-section">
          <div className="section-icon"><FolderIcon /></div>
          <div className="section-content">
            <h3>Report Categories</h3>
            <div className="category-grid">
              <div className="category-box">
                <span className="cat-icon"><TrashIcon /></span>
                <strong>Waste Issue</strong>
                <p>Report illegal dumping, uncollected garbage, or waste affecting rivers, waterways, and natural water bodies in your area.</p>
              </div>
              <div className="category-box">
                <span className="cat-icon"><WaveIcon /></span>
                <strong>Drainage Issue</strong>
                <p>Report drainage problems or flooding caused by clogged or damaged drainage systems in your area.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Who We Work With */}
        <div className="about-section">
          <div className="section-icon"><BankIcon /></div>
          <div className="section-content">
            <h3>Who the System Supports</h3>
            <p><strong>City ENRO</strong><br />Handles waste-related reports, including illegal dumping and uncollected garbage.</p>
            <p><strong>City Engineering Office</strong><br />Handles drainage-related reports, including clogged drainage, damaged drainage, and flooding.</p>
            <p><strong>Environmental Management Bureau (EMB)</strong><br />Serves as a monitoring stakeholder with read-only access to environmental reports and statistics.</p>
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
          <span className="nav-icon"><HomeIcon /></span>
          <span>Home</span>
        </a>
        <a href="/track-report" className="bottom-nav-item">
          <span className="nav-icon"><TrackIcon /></span>
          <span>Track Report</span>
        </a>
        <a href="/about" className="bottom-nav-item active">
          <span className="nav-icon"><AboutIcon /></span>
          <span>About</span>
        </a>
      </div>
    </div>
  );
}

export default About;