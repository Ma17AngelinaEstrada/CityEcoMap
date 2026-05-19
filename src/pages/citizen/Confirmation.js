import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import logowhite from '../../logowhite2.png';
import './Confirmation.css';

function Confirmation() {
  const navigate = useNavigate();
  const [reportId, setReportId] = useState('');
  const [copied, setCopied] = useState(false);
  const blockRef = useRef(true);

  useEffect(() => {
    const id = 'WI' + Math.random().toString(36).substring(2, 7).toUpperCase();
    setReportId(id);

    // Push many states to block back button
    for (let i = 0; i < 5; i++) {
      window.history.pushState(null, '', window.location.href);
    }

    const blockNavigation = () => {
      if (blockRef.current) {
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('popstate', blockNavigation);
    return () => window.removeEventListener('popstate', blockNavigation);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(`#${reportId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goToMap = () => {
    // Disable the back block before navigating
    blockRef.current = false;

    // Clear all history and replace with map
    const stepsBack = window.history.length;
    window.history.go(-stepsBack);

    setTimeout(() => {
      navigate('/map', { replace: true });
    }, 100);
  };

  return (
    <div className="confirm-container">
      <div className="confirm-header">
        <img src={logowhite} alt="CityEcoMap" className="confirm-logo" />
      </div>

      <div className="confirm-body">
        <div className="confirm-card">

          <h2 className="confirm-title">REPORT SUBMITTED</h2>

          <div className="check-circle">
            <span className="check-icon">✔</span>
          </div>

          <h3 className="thank-you">Thank you!</h3>
          <p className="thank-you-sub">Your report has been submitted.</p>
          <hr className="divider" />

          <p className="report-id-text">Report ID: <strong>#{reportId}</strong></p>

          <div className="warning-box">
            <span className="warning-icon">⚠️</span>
            <p>Please save or copy your Report ID to track your report status.</p>
          </div>

          <button className="copy-btn" onClick={handleCopy}>
            📋 {copied ? 'Copied!' : 'Copy Report ID'}
          </button>

          <button className="map-btn" onClick={goToMap}>
            View on Map
          </button>

          <button className="home-link" onClick={goToMap}>
            Go to Home
          </button>

        </div>
      </div>
    </div>
  );
}

export default Confirmation;