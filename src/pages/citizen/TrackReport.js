import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../logowhite2.png';
import './TrackReport.css';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import '../../styles/CitizenHeader.css';
import { SearchIcon, HourglassIcon, ThumbsUpIcon, RefreshIcon, CheckCircleIcon, XCircleIcon, IdIcon, TrashIcon, ClipboardIcon, BuildingIcon, HomeIcon, TrackIcon, AboutIcon } from '../../components/Icons';
import OnboardingTour from '../../components/OnboardingTour';

const TOUR_STEPS = [
  {
    selector: '.report-id-input-wrapper',
    title: 'Enter Your Report ID',
    description: 'Type the Report ID you received when you submitted your report (e.g. #WI12345).',
  },
  {
    selector: '.search-btn',
    title: 'Search',
    description: 'Tap here to look up your report\u2019s current status.',
  },
  {
    selector: '.track-body',
    title: 'Report Details',
    description: 'Once you search, you\u2019ll see the status, details, and progress timeline of your report here.',
  },
  {
    selector: '.bottom-nav',
    title: 'Navigation Menu',
    description: 'Use these buttons to go Home, Track your Report, or view the About page anytime.',
  },
];

const SAMPLE_REPORT = {
  id: 'WI12345',
  category: 'Waste Issue',
  subCategory: 'Uncollected Garbage',
  areaType: 'Sidewalk',
  description: 'Uncollected garbage piling up near the corner store.',
  status: 'Ongoing',
  date: 'Aug 20, 2026',
  assignedTo: 'LGU',
  rejectionReason: null,
};

function TrackReport() {
// eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  const [reportId, setReportId] = useState('');
  const [searched, setSearched] = useState(false);
  const [report, setReport] = useState(null);
  const [showTour, setShowTour] = useState(false);
  const [showSample, setShowSample] = useState(false);

  // Auto-show the sample report preview once the tour opens,
  // so the "Report Details" step has something real to point at
  useEffect(() => {
    if (showTour) {
      setShowSample(true);
    }
  }, [showTour]);
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
        subCategory: data.subCategory,
        areaType: data.areaType,
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
    if (status === 'Pending') return '#e53935';
    if (status === 'Approved') return '#1565c0';
    if (status === 'Ongoing') return '#f9a825';
    if (status === 'Resolved') return '#2e7d32';
    if (status === 'Rejected') return '#757575';
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

  // Renders the same status banner / details grid / timeline markup for
  // either a real report or the SAMPLE_REPORT preview
  const renderReportDetails = (data) => (
    <div className="result-section">

      {/* Status Banner */}
      <div className="status-banner" style={{ background: getStatusColor(data.status) }}>
        <span className="status-icon">{getStatusIcon(data.status)}</span>
        <span>Status: <strong>{data.status}</strong></span>
      </div>

            {/* Details Grid */}
            <div className="details-grid">
              <div className="detail-box">
                <span className="detail-label"><IdIcon /> Report ID</span>
                <span className="detail-value">#{data.id}</span>
              </div>
              <div className="detail-box">
                <span className="detail-label"><TrashIcon /> Category</span>
                <span className="detail-value">{data.category}</span>
              </div>
              <div className="detail-box">
                <span className="detail-label"><TrashIcon /> Specific Issue</span>
                <span className="detail-value">{data.subCategory || '—'}</span>
              </div>
              <div className="detail-box">
                <span className="detail-label"><BuildingIcon /> Type of Area</span>
                <span className="detail-value">{data.areaType || '—'}</span>
              </div>
              <div className="detail-box">
                <span className="detail-label"><HourglassIcon /> Date Submitted</span>
                <span className="detail-value">{data.date}</span>
              </div>
              <div className="detail-box full-width">
                <span className="detail-label"><ClipboardIcon /> Description</span>
                <span className="detail-value">{data.description}</span>
              </div>
            </div>

      {data.status === 'Approved' || data.status === 'Ongoing' || data.status === 'Resolved' ? (
        data.assignedTo && (
          <div className="details-grid">
            <div className="detail-box full-width">
              <span className="detail-label"><BuildingIcon /> Assigned To</span>
              <span className="detail-value">{data.assignedTo}</span>
            </div>
          </div>
        )
      ) : null}

      {data.status === 'Rejected' && (
        <div className="details-grid">
          <div className="detail-box full-width">
            <span className="detail-label"><XCircleIcon /> Rejection Reason</span>
            <span className="detail-value">{data.rejectionReason || 'No reason provided.'}</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="timeline-section">
        <h3 className="timeline-title">Report Progress</h3>

        {data.status === 'Rejected' ? (
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

            <div className={`timeline-line ${['Approved', 'Ongoing', 'Resolved'].includes(data.status) ? 'active' : ''}`}></div>
            <div className={`timeline-step ${['Approved', 'Ongoing', 'Resolved'].includes(data.status) ? 'done' : ''}`}>
              <div className={`timeline-dot ${['Approved', 'Ongoing', 'Resolved'].includes(data.status) ? 'active' : ''}`}><ThumbsUpIcon /></div>
              <span>Approved</span>
            </div>

            <div className={`timeline-line ${['Ongoing', 'Resolved'].includes(data.status) ? 'active' : ''}`}></div>
            <div className={`timeline-step ${['Ongoing', 'Resolved'].includes(data.status) ? 'done' : ''}`}>
              <div className={`timeline-dot ${['Ongoing', 'Resolved'].includes(data.status) ? 'active' : ''}`}><RefreshIcon /></div>
              <span>Ongoing</span>
            </div>

            <div className={`timeline-line ${data.status === 'Resolved' ? 'active' : ''}`}></div>
            <div className={`timeline-step ${data.status === 'Resolved' ? 'done' : ''}`}>
              <div className={`timeline-dot ${data.status === 'Resolved' ? 'active' : ''}`}><CheckCircleIcon /></div>
              <span>Resolved</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );

  return (
    <div className="track-container">
      {/* Header */}
      <div className="citizen-header">
        <div className="header-logo">
          <img src={logo} alt="CityEcoMap" className="logo-img" />
        </div>
        <div className="header-right">
          <nav className="header-nav">
            <a href="/map" className="nav-link">Home</a>
            <a href="/track-report" className="nav-link active">Track Report</a>
            <a href="/about" className="nav-link">About</a>
          </nav>
          <button
            className="header-help-btn"
            onClick={() => setShowTour(true)}
            title="Show guide"
          >
            ?
          </button>
        </div>
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
            <button
              type="button"
              className="sample-preview-btn"
              onClick={() => setShowSample(!showSample)}
            >
              {showSample ? 'Hide sample' : 'See what a report looks like'}
            </button>
          </div>
        )}

        {!searched && showSample && (
          <div className="sample-preview-wrapper">
            <p className="sample-preview-label">Sample preview — not a real report</p>
            {renderReportDetails(SAMPLE_REPORT)}
          </div>
        )}

        {searched && report && renderReportDetails(report)}

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
      {showTour && (
        <OnboardingTour
          steps={TOUR_STEPS}
          onFinish={() => { setShowTour(false); setShowSample(false); }}
          storageKey="cityecomap_tour_seen_track"
        />
      )}
    </div>
  );
}

export default TrackReport;