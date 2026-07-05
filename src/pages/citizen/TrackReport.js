import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../logowhite2.png';
import './TrackReport.css';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import '../../styles/CitizenHeader.css';
import { SearchIcon, HourglassIcon, ThumbsUpIcon, RefreshIcon, CheckCircleIcon, XCircleIcon, IdIcon, TrashIcon, ClipboardIcon, BuildingIcon, HomeIcon, TrackIcon, AboutIcon } from '../../components/Icons';

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
        assignedTo: data.assignedTo || null,
        rejectionReason: data.rejectionReason || null,
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
    if (status === 'Approved') return '#3498db';
    if (status === 'Ongoing') return '#1a6b3c';
    if (status === 'Resolved') return '#2ecc71';
    if (status === 'Rejected') return '#e74c3c';
    return '#888';
  };

  const getStatusIcon = (status) => {
    if (status === 'Pending') return <HourglassIcon />;
    if (status === 'Approved') return <ThumbsUpIcon />;
    if (status === 'Ongoing') return <RefreshIcon />;
    if (status === 'Resolved') return <CheckCircleIcon />;
    if (status === 'Rejected') return <XCircleIcon />;
    return null;
  };

  return (
    <div className="track-container">
      {/* Header */}
      <div className="citizen-header">
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
          <div className="report-id-input-wrapper">
            <span className="search-icon"><SearchIcon /></span>
            <input
              type="text"
              className="report-id-input"
              placeholder="Enter Report ID (e.g. #WI12345)"
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button className="search-btn" onClick={handleSearch}>
            Search
          </button>
        </div>
      </div>

      {/* Results Section */}
      <div className="track-body">

        {!searched && (
          <div className="empty-state">
            <span className="empty-icon"><ClipboardIcon /></span>
            <h3>No report searched yet</h3>
            <p>Enter your Report ID above to track the status of your report.</p>
          </div>
        )}

        {searched && report && (
          <div className="result-section">

            {/* Status Banner */}
            <div className="status-banner" style={{ background: getStatusColor(report.status) }}>
              <span className="status-icon">{getStatusIcon(report.status)}</span>
              <span>Status: <strong>{report.status}</strong></span>
            </div>

            {/* Details Grid */}
            <div className="details-grid">
              <div className="detail-box">
                <span className="detail-label"><IdIcon /> Report ID</span>
                <span className="detail-value">#{report.id}</span>
              </div>
              <div className="detail-box">
                <span className="detail-label"><TrashIcon /> Category</span>
                <span className="detail-value">{report.category}</span>
              </div>
              <div className="detail-box">
                <span className="detail-label"><HourglassIcon /> Date Submitted</span>
                <span className="detail-value">{report.date}</span>
              </div>
              <div className="detail-box full-width">
                <span className="detail-label"><ClipboardIcon /> Description</span>
                <span className="detail-value">{report.description}</span>
              </div>
            </div>

            {report.status === 'Approved' || report.status === 'Ongoing' || report.status === 'Resolved' ? (
              report.assignedTo && (
                <div className="details-grid">
                  <div className="detail-box full-width">
                    <span className="detail-label"><BuildingIcon /> Assigned To</span>
                    <span className="detail-value">{report.assignedTo}</span>
                  </div>
                </div>
              )
            ) : null}

            {report.status === 'Rejected' && (
              <div className="details-grid">
                <div className="detail-box full-width">
                  <span className="detail-label"><XCircleIcon /> Rejection Reason</span>
                  <span className="detail-value">{report.rejectionReason || 'No reason provided.'}</span>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="timeline-section">
              <h3 className="timeline-title">Report Progress</h3>

              {report.status === 'Rejected' ? (
                <div className="status-timeline status-timeline--rejected">
                  <div className="timeline-step done rejected">
                    <div className="timeline-dot active rejected"><XCircleIcon /></div>
                    <span>Rejected</span>
                  </div>
                </div>
              ) : (
                <div className="status-timeline">
                  <div className="timeline-step done">
                    <div className="timeline-dot active"><HourglassIcon /></div>
                    <span>Pending</span>
                  </div>

                  <div className={`timeline-line ${['Approved', 'Ongoing', 'Resolved'].includes(report.status) ? 'active' : ''}`}></div>
                  <div className={`timeline-step ${['Approved', 'Ongoing', 'Resolved'].includes(report.status) ? 'done' : ''}`}>
                    <div className={`timeline-dot ${['Approved', 'Ongoing', 'Resolved'].includes(report.status) ? 'active' : ''}`}><ThumbsUpIcon /></div>
                    <span>Approved</span>
                  </div>

                  <div className={`timeline-line ${['Ongoing', 'Resolved'].includes(report.status) ? 'active' : ''}`}></div>
                  <div className={`timeline-step ${['Ongoing', 'Resolved'].includes(report.status) ? 'done' : ''}`}>
                    <div className={`timeline-dot ${['Ongoing', 'Resolved'].includes(report.status) ? 'active' : ''}`}><RefreshIcon /></div>
                    <span>Ongoing</span>
                  </div>

                  <div className={`timeline-line ${report.status === 'Resolved' ? 'active' : ''}`}></div>
                  <div className={`timeline-step ${report.status === 'Resolved' ? 'done' : ''}`}>
                    <div className={`timeline-dot ${report.status === 'Resolved' ? 'active' : ''}`}><CheckCircleIcon /></div>
                    <span>Resolved</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {searched && !report && (
          <div className="not-found">
            <p><XCircleIcon /> Report not found. Please check your Report ID and try again.</p>
          </div>
        )}

      </div>

      {/* Bottom Nav - Mobile Only */}
      <div className="bottom-nav">
        <a href="/map" className="bottom-nav-item">
          <span className="nav-icon"><HomeIcon /></span>
          <span>Home</span>
        </a>
        <a href="/track-report" className="bottom-nav-item active">
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

export default TrackReport;