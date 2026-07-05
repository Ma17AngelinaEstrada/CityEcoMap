import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../logowhite2.png';
import './SubmitReport.css';
import '../../styles/CitizenHeader.css';
import { TrashIcon, WaveIcon, CheckIcon, CameraIcon, ImageIcon, XIcon, PinIcon, ArrowLeftIcon } from '../../components/Icons';

function SubmitReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const previousForm = location.state?.previousForm;

  const [selectedCategory, setSelectedCategory] = useState(previousForm?.selectedCategory || '');
  const [description, setDescription] = useState(previousForm?.description || '');
  const [email, setEmail] = useState(previousForm?.email || '');
  const [photo, setPhoto] = useState(previousForm?.photo || null);
  const [photoPreview, setPhotoPreview] = useState(previousForm?.photoPreview || null);
  const [location2, setLocation2] = useState(null);
  const [locationDescription, setLocationDescription] = useState(previousForm?.locationDescription || '');

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation2({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => setLocation2(null)
      );
    }
  }, []);

  // Block browser back button if there's progress
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      const hasProgress = selectedCategory || description || email || photo;
      if (hasProgress) {
        window.history.pushState(null, '', window.location.href);
        if (window.confirm('You have unsaved progress. Are you sure you want to leave?')) {
          navigate('/map', { replace: true });
        }
      } else {
        navigate('/map', { replace: true });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedCategory, description, email, photo, navigate]);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const isValidEmail = (email) => {
    if (!email.trim()) return true; // empty is OK since it's optional
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSubmit = () => {
    if (!selectedCategory) {
      alert('Please select a report category.');
      return;
    }
    if (!photo) {
      alert('Please attach a photo. A photo is required for GPS location tagging.');
      return;
    }
    if (!description) {
      alert('Please write a description of the issue.');
      return;
    }
    if (!isValidEmail(email)) {
      alert('Please enter a valid email address, or leave it blank.');
      return;
    }
    navigate('/review-report', {
      state: { form: { selectedCategory, description, email, photo, photoPreview, location: location2, locationDescription } }
    });
  };

  return (
    <div className="report-container">
      <div className="citizen-header report-header">
        <button className="header-back-btn" onClick={() => {
          const hasProgress = selectedCategory || description || email || photo;
          if (hasProgress) {
            if (!window.confirm('You have unsaved progress. Are you sure you want to leave?')) return;
          }
          navigate('/map');
        }}><ArrowLeftIcon /></button>
        <img src={logo} alt="CityEcoMap" className="logo-img" />
        <button className="header-close-btn" onClick={() => {
          const hasProgress = selectedCategory || description || email || photo;
          if (hasProgress) {
            if (!window.confirm('You have unsaved progress. Are you sure you want to leave?')) return;
          }
          navigate('/map');
        }}><XIcon /></button>
      </div>

      <div className="report-body">
        <div className="report-form-card">

          <h2 className="form-title">REPORT AN ISSUE</h2>
          <p className="form-subtitle">Choose a report type, add a photo, and describe the issue.</p>

          <div className="category-section">
            <div
              className={`category-card ${selectedCategory === 'Waste Issue' ? 'selected' : ''}`}
              onClick={() => setSelectedCategory('Waste Issue')}
            >
              {selectedCategory === 'Waste Issue' && <span className="check"><CheckIcon /></span>}
              <span className="category-icon"><TrashIcon /></span>
              <strong>Waste Issue</strong>
              <p>Report problems related to garbage and litter.</p>
            </div>
            <div
              className={`category-card ${selectedCategory === 'Drainage Issue' ? 'selected' : ''}`}
              onClick={() => setSelectedCategory('Drainage Issue')}
            >
              {selectedCategory === 'Drainage Issue' && <span className="check"><CheckIcon /></span>}
              <span className="category-icon"><WaveIcon /></span>
              <strong>Drainage Issue</strong>
              <p>Report problems related to drainage and flooding.</p>
            </div>
          </div>

          <div className="section-label">ADD PHOTO</div>
<div className="photo-options">
  <label className="photo-option-btn" htmlFor="photo-camera">
    <CameraIcon /> Take a Photo
  </label>
  <input
    id="photo-camera"
    type="file"
    accept="image/*"
    capture="environment"
    onChange={handlePhoto}
    style={{ display: 'none' }}
  />
  <label className="photo-option-btn" htmlFor="photo-gallery">
    <ImageIcon /> Upload from Gallery
  </label>
  <input
    id="photo-gallery"
    type="file"
    accept="image/*"
    onChange={handlePhoto}
    style={{ display: 'none' }}
  />
</div>

{photoPreview && (
  <div className="photo-preview-wrapper">
    <img src={photoPreview} alt="Preview" className="photo-preview" />
    <button
      className="photo-remove-btn"
      onClick={() => { setPhoto(null); setPhotoPreview(null); }}
    >
      <XIcon /> Remove photo
    </button>
  </div>
)}

          <div className="section-label">DESCRIPTION</div>
          <textarea
            className="description-input"
            placeholder="Write a detailed description of the issue..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <div className="char-count">{description.length} / 500</div>

          <div className="section-label">GET NOTIFIED <span className="optional">(Optional)</span></div>
          <p className="notify-note">Enter your email address to receive updates about your report status. (Leave blank if you prefer to track using your Report ID)</p>
          <input
            type="email"
            className="email-input"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <p className="location-note"><PinIcon /> Your current location will be automatically detected.</p>

          <div className="section-label">
            LOCATION DESCRIPTION <span className="optional">(Optional)</span>
          </div>
          <p className="notify-note">
            Help us pinpoint the exact spot — e.g. "Near Jollibee, Brgy. 3" or "Beside the basketball court."
          </p>
          <input
            type="text"
            className="email-input"
            placeholder="e.g. Near the public market, Brgy. 5"
            value={locationDescription}
            onChange={(e) => setLocationDescription(e.target.value)}
            maxLength={150}
          />

          <button className="submit-btn" onClick={handleSubmit}>
            Review & Submit
          </button>

        </div>
      </div>
    </div>
  );
}

export default SubmitReport;