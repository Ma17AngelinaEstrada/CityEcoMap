import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../logowhite2.png';
import './ReviewSubmit.css';

function ReviewSubmit() {
  const navigate = useNavigate();
  const location = useLocation();
  const { form } = location.state || {};
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!form) {
      navigate('/map', { replace: true });
      return;
    }

    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      navigate('/submit-report', { state: { previousForm: form }, replace: true });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [form, navigate]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setTimeout(() => {
      navigate('/confirmation', { replace: true });
    }, 1500);
  };

  const getAddress = () => {
    if (form?.location) {
      return `${form.location.lat.toFixed(4)}° N, ${form.location.lng.toFixed(4)}° E`;
    }
    return 'Location not detected';
  };

  return (
    <div className="review-container">
      <div className="review-header">
        <button className="header-back-btn" onClick={() =>
          navigate('/submit-report', { state: { previousForm: form } })
        }>←</button>
        <img src={logo} alt="CityEcoMap" className="review-logo" />
        <button className="header-close-btn" onClick={() => {
          if (window.confirm('Are you sure you want to cancel? Your report will not be submitted.')) {
            navigate('/map', { replace: true });
          }
        }}>✕</button>
      </div>

      <div className="review-body">
        <div className="review-card">
          <h2 className="review-title">REVIEW & SUBMIT</h2>
          <p className="review-subtitle">Please review your report details before submitting.</p>

          <div className="summary-card">
            <h3 className="summary-title">Report Summary</h3>
            <hr />
            <div className="summary-row">
              <div className="summary-icon">🗑️</div>
              <div className="summary-info">
                <span className="summary-label">Report Type</span>
                <span className="summary-value">{form?.selectedCategory || 'Not selected'}</span>
                <span className="summary-desc">
                  {form?.selectedCategory === 'Waste Issue'
                    ? 'Report problems related to garbage and litter.'
                    : 'Report problems related to drainage and flooding.'}
                </span>
              </div>
            </div>
            <hr />
            <div className="summary-row">
              <div className="summary-icon">📷</div>
              <div className="summary-info">
                <span className="summary-label">Photo</span>
                <span className="summary-value">
                  {form?.photoPreview ? '1 photo attached' : 'No photo attached'}
                </span>
              </div>
              {form?.photoPreview && (
                <img src={form.photoPreview} alt="Report" className="summary-photo" />
              )}
            </div>
            <hr />
            <div className="summary-row">
              <div className="summary-icon">📋</div>
              <div className="summary-info">
                <span className="summary-label">Description</span>
                <span className="summary-value">{form?.description || 'No description provided'}</span>
              </div>
            </div>
            <hr />
            <div className="summary-row">
              <div className="summary-icon">📍</div>
              <div className="summary-info">
                <span className="summary-label">Location</span>
                <span className="summary-value">
                  {form?.location ? 'Current Location Detected' : 'Location not detected'}
                </span>
                <span className="summary-desc">{getAddress()}</span>
              </div>
            </div>
            <hr />
            <div className="summary-row">
              <div className="summary-icon">✉️</div>
              <div className="summary-info">
                <span className="summary-label">Email</span>
                <span className="summary-value">
                  {form?.email || <em>Not provided (track using Report ID)</em>}
                </span>
              </div>
            </div>
          </div>

          <p className="review-note">Your report helps build a cleaner, greener city. Thank you!</p>

          <button className="submit-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReviewSubmit;