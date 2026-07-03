import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../logowhite2.png';
import './ReviewSubmit.css';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { reverseGeocode } from '../../utils/geocode';
import '../../styles/CitizenHeader.css';

function ReviewSubmit() {
  const navigate = useNavigate();
  const location = useLocation();
  const { form } = location.state || {};
  const [submitting, setSubmitting] = useState(false);
  const [readableAddress, setReadableAddress] = useState('');

  useEffect(() => {
    const resolveAddress = async () => {
      if (form?.location?.lat && form?.location?.lng) {
        const addr = await reverseGeocode(form.location.lat, form.location.lng);
        setReadableAddress(addr);
      }
    };
    resolveAddress();
  }, [form]);

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
  try {
    // Generate Report ID
    const reportId = 'WI' + Math.random().toString(36).substring(2, 7).toUpperCase();

    // Compress photo to base64 if exists
    let photoBase64 = null;
    if (form?.photo) {
      photoBase64 = await compressPhoto(form.photo);
    }

    // Save to Firestore
    await addDoc(collection(db, 'reports'), {
      reportId,
      category: form?.selectedCategory,
      description: form?.description,
      email: form?.email || null,
      location: form?.location || null,
      locationDescription: form?.locationDescription || null,
      photo: photoBase64,
      status: 'Pending',
      createdAt: serverTimestamp(),
    });

    navigate('/confirmation', {
      replace: true,
      state: { reportId, location: form?.location }
    });

  } catch (error) {
    console.error('Error submitting report:', error);
    alert('Failed to submit report. Please try again.');
    setSubmitting(false);
  }
};

const compressPhoto = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 500;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

  const getAddress = () => {
    if (readableAddress) return readableAddress;
    if (form?.location) {
      return 'Detecting address...';
    }
    return 'Location not detected';
  };

  return (
    <div className="review-container">
      <div className="citizen-header review-header">
        <button className="header-back-btn" onClick={() =>
          navigate('/submit-report', { state: { previousForm: form } })
        }>←</button>
        <img src={logo} alt="CityEcoMap" className="logo-img" />
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
                {form?.locationDescription && (
                  <span className="summary-desc" style={{ marginTop: '4px', fontStyle: 'italic' }}>
                    "{form.locationDescription}"
                  </span>
                )}
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