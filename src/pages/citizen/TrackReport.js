import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../logowhite2.png';
import './TrackReport.css';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/firebase';

function TrackReport() {
// eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  const [reportId, setReportId] = useState('');
  const [searched, setSearched] = useState(false);
  const [report, setReport] = useState(null);

  const handleSearch = async () => {
  if (!reportId.trim()) {
    alert('Please enter a Report ID.');
    return;
  }
  setSearched(true);
  setReport(null);

  try {
    const q = query(
      collection(db, 'reports'),
      where('reportId', '==', reportId.trim().replace('#', ''))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const data = querySnapshot.docs[0].data();
      setReport({
        id: data.reportId,
        category: data.category,
        description: data.description,
        status: data.status,
        date: data.createdAt?.toDate().toLocaleDateString() || 'N/A',
        photo: data.photo,
      });
    } else {
      setReport(null);
    }
  } catch (error) {
    console.error('Error fetching report:', error);
    alert('Error fetching report. Please try again.');
  }
};

  const getStatusColor = (status) => {
    if (status === 'Pending') return '#f0a500';
    if (status === 'In Progress') return '#1a6b3c';
    if (status === 'Resolved') return '#2ecc71';
    return '#888';
  };

  const getStatusIcon = (status) => {
    if (status === 'Pending') return '⏳';
    if (status === 'In Progress') return '🔄';
    if (status === 'Resolved') return '✅';
    return '❓';
  };

  return (
    <div className="track-container">
      {/* Header */}
      <div className="track-header">
        <div className="header-logo">
          <img src={logo} alt="CityEcoMap" className="logo-img" />
        </div>
        <nav className="header-nav">
          <a href="/map" className="nav-link">Home</a>
          <a href="/track-report" className="nav-link active">Track Report</a>
          <a href="/about" className="nav-link">About</a>
        </nav>
      </div>

      {/* Hero Search Section */}
      <div className="track-hero">
        <h2 className="track-title">TRACK YOUR REPORT</h2>
        <p className="track-subtitle">Enter your Report ID to check the status of your submitted report.</p>
        <div className="search-section">
          <input
            type="text"
            className="report-id-input"
            placeholder="Enter Report ID (e.g. #WI12345)"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="search-btn" onClick={handleSearch}>
            🔍 Search
          </button>
        </div>
      </div>

      {/* Results Section */}
      <div className="track-body">

        {!searched && (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No report searched yet</h3>
            <p>Enter your Report ID above to track the status of your report.</p>
          </div>
        )}

        {searched && report && (
          <div className="result-section">

            {/* Status Banner */}
            <div className="status-banner" style={{ background: getStatusColor(report.status) }}>
              <span>{getStatusIcon(report.status)}</span>
              <span>Status: <strong>{report.status}</strong></span>
            </div>

            {/* Details Grid */}
            <div className="details-grid">
              <div className="detail-box">
                <span className="detail-label">🆔 Report ID</span>
                <span className="detail-value">#{report.id}</span>
              </div>
              <div className="detail-box">
                <span className="detail-label">🗑️ Category</span>
                <span className="detail-value">{report.category}</span>
              </div>
              <div className="detail-box">
                <span className="detail-label">📅 Date Submitted</span>
                <span className="detail-value">{report.date}</span>
              </div>
              <div className="detail-box full-width">
                <span className="detail-label">📋 Description</span>
                <span className="detail-value">{report.description}</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="timeline-section">
              <h3 className="timeline-title">Report Progress</h3>
              <div className="status-timeline">
                <div className={`timeline-step done`}>
                  <div className="timeline-dot active">⏳</div>
                  <span>Pending</span>
                </div>
                <div className={`timeline-line ${report.status === 'In Progress' || report.status === 'Resolved' ? 'active' : ''}`}></div>
                <div className={`timeline-step ${report.status === 'In Progress' || report.status === 'Resolved' ? 'done' : ''}`}>
                  <div className={`timeline-dot ${report.status === 'In Progress' || report.status === 'Resolved' ? 'active' : ''}`}>🔄</div>
                  <span>In Progress</span>
                </div>
                <div className={`timeline-line ${report.status === 'Resolved' ? 'active' : ''}`}></div>
                <div className={`timeline-step ${report.status === 'Resolved' ? 'done' : ''}`}>
                  <div className={`timeline-dot ${report.status === 'Resolved' ? 'active' : ''}`}>✅</div>
                  <span>Resolved</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {searched && !report && (
          <div className="not-found">
            <p>❌ Report not found. Please check your Report ID and try again.</p>
          </div>
        )}

      </div>

      {/* Bottom Nav - Mobile Only */}
      <div className="bottom-nav">
        <a href="/map" className="bottom-nav-item">
          <span>🏠</span>
          <span>Home</span>
        </a>
        <a href="/track-report" className="bottom-nav-item active">
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

export default TrackReport;