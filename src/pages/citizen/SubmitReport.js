import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../logowhite2.png';
import embLogo from '../../emb-logo.png';
import './SubmitReport.css';
import '../../styles/CitizenHeader.css';
import { TrashIcon, WaveIcon, CheckIcon, CameraIcon, ImageIcon, XIcon, PinIcon, ArrowLeftIcon } from '../../components/Icons';
import OnboardingTour from '../../components/OnboardingTour';

const SUB_CATEGORIES = {
  'Waste Issue': [
    'Illegal Dumping',
    'Uncollected Garbage',
    'Waste Affecting Rivers, Waterways, and Natural Water Bodies',
    'Other',
  ],
  'Drainage Issue': [
    'Blocked Drainage',
    'Damaged Drainage',
    'Flooding',
    'Other',
  ],
};

const AREA_TYPES = [
  'Road',
  'Sidewalk',
  'Canal',
  'Esteros (Waterway)',
  'Vacant Lot',
  'Residential Area',
  'Establishment/Commercial Area',
  'Bridge',
  'Coastal Area',
  'Park',
  'Other',
];

const TOUR_STEPS = [
  {
    selector: '#field-name',
    title: 'Your Name',
    description: 'Enter your name here. This is required and will be shown as the submitter of the report.',
  },
  {
    selector: '.category-section',
    title: 'Choose a Category',
    description: 'Select whether this is a Waste Issue or a Drainage Issue.',
  },
  {
    selector: '#field-specific-issue',
    title: 'Specific Issue',
    description: 'Pick the specific type of issue, like Illegal Dumping or Blocked Drainage. This section appears once you choose a category above.',
  },
  {
    selector: '#field-area-type',
    title: 'Type of Area',
    description: 'Tell us what kind of area this is (road, sidewalk, vacant lot, etc.) so the team can prepare the right equipment.',
  },
    {
    selector: '.photo-options',
    title: 'Add a Photo',
    description: 'Take a photo or upload one from your gallery. A photo is required.',
  },
  {
    selector: '#field-description',
    title: 'Describe the Issue',
    description: 'Write a short description of what you\u2019re reporting — what you see, and any other helpful details.',
  },
  {
    selector: '#field-email',
    title: 'Get Notified (Optional)',
    description: 'Enter your email to get status updates directly, or leave it blank and track your report using your Report ID instead.',
  },
  {
    selector: '#field-address',
    title: 'Address',
    description: 'Start typing an address and select it from the suggestions, or use your current location.',
  },
  {
    selector: '#field-exact-spot',
    title: 'Exact Spot',
    description: 'If the address covers a large area, describe exactly where the issue is \u2014 e.g. "Beside the basketball court."',
  },
  {
    selector: '.submit-btn',
    title: 'Review & Submit',
    description: 'Once everything is filled out, tap here to review your report before sending it.',
  },
];

function SubmitReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const previousForm = location.state?.previousForm;

  const [fullName, setFullName] = useState(previousForm?.fullName || '');
  const [selectedCategory, setSelectedCategory] = useState(previousForm?.selectedCategory || '');
  const [subCategory, setSubCategory] = useState(previousForm?.subCategory || '');
  const [otherSubCategory, setOtherSubCategory] = useState(previousForm?.otherSubCategory || '');
  const [areaType, setAreaType] = useState(previousForm?.areaType || '');
  const [otherAreaType, setOtherAreaType] = useState(previousForm?.otherAreaType || '');
  const [description, setDescription] = useState(previousForm?.description || '');
  const [email, setEmail] = useState(previousForm?.email || '');
  const [photo, setPhoto] = useState(previousForm?.photo || null);
  const [photoPreview, setPhotoPreview] = useState(previousForm?.photoPreview || null);
  const [location2, setLocation2] = useState(previousForm?.location || null);
  const [addressInput, setAddressInput] = useState(previousForm?.addressInput || '');
  const [locationDescription, setLocationDescription] = useState(previousForm?.locationDescription || '');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const addressDebounceRef = useRef(null);
  const [showTour, setShowTour] = useState(false);

  // Reset sub-category whenever the parent category changes
  useEffect(() => {
    if (!previousForm) {
      setSubCategory('');
      setOtherSubCategory('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

    // Auto-select a sample category when the tour opens, so Specific Issue
    // and Type of Area fields render for the walkthrough
    useEffect(() => {
      if (showTour && !selectedCategory) {
        setSelectedCategory('Waste Issue');
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showTour]);

  // Block browser back button if there's progress
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      const hasProgress = fullName || selectedCategory || description || email || photo;
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
  }, [fullName, selectedCategory, description, email, photo, navigate]);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const isValidEmail = (email) => {
    if (!email.trim()) return true;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleAddressChange = (value) => {
    setAddressInput(value);
    setLocation2(null); // hindi na valid ang dating napiling coords kapag nag-type ulit
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (!value.trim() || value.trim().length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    addressDebounceRef.current = setTimeout(async () => {
      setSearchingAddress(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=5&countrycodes=ph&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        setAddressSuggestions(data);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Address search failed:', err);
      } finally {
        setSearchingAddress(false);
      }
    }, 600);
  };

  const handleSelectSuggestion = (place) => {
    setAddressInput(place.display_name);
    setLocation2({ lat: parseFloat(place.lat), lng: parseFloat(place.lon) });
    setAddressSuggestions([]);
    setShowSuggestions(false);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Location services are not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation2(coords);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          setAddressInput(data.display_name || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        } catch {
          setAddressInput(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        }
      },
      () => alert('Unable to get your current location. Please type your address instead.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = () => {
    if (!fullName.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (!selectedCategory) {
      alert('Please select a report category.');
      return;
    }
    if (!subCategory) {
      alert('Please select a specific issue type.');
      return;
    }
    if (subCategory === 'Other' && !otherSubCategory.trim()) {
  alert('Please specify the issue type.');
  return;
    }
    if (!areaType) {
      alert('Please select the type of area.');
      return;
    }
    if (areaType === 'Other' && !otherAreaType.trim()) {
      alert('Please specify the type of area.');
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
    if (!location2) {
      alert('Please enter and select an address for this report.');
      return;
    }
    if (!locationDescription.trim()) {
      alert('Please specify the exact spot of the issue.');
      return;
    }
    if (!isValidEmail(email)) {
      alert('Please enter a valid email address, or leave it blank.');
      return;
    }
    navigate('/review-report', {
      state: {
        form: {
          fullName,
          selectedCategory,
          subCategory: subCategory === 'Other' ? otherSubCategory : subCategory,
          areaType: areaType === 'Other' ? otherAreaType : areaType,
          description,
          email,
          photo,
          photoPreview,
          location: location2,
          addressInput,
          locationDescription,
        }
      }
    });
  };

  const hasProgress = fullName || selectedCategory || description || email || photo;

  const handleLeave = () => {
    if (hasProgress) {
      if (!window.confirm('You have unsaved progress. Are you sure you want to leave?')) return;
    }
    navigate('/map');
  };

  return (
    <div className="report-container">
      <div className="citizen-header report-header">
        <button className="header-back-btn" onClick={handleLeave}><ArrowLeftIcon /></button>
        <div className="header-logo">
          <img src={logo} alt="CityEcoMap" className="logo-img" />
          <span className="logo-divider" />
          <img src={embLogo} alt="EMB" className="partner-logo-img" />
        </div>
        <div className="header-actions">
          <button className="header-help-btn" onClick={() => setShowTour(true)} title="Show guide">?</button>
          <button className="header-close-btn" onClick={handleLeave}><XIcon /></button>
        </div>
      </div>

      <div className="report-body">
        <div className="report-form-card">

          <h2 className="form-title">REPORT AN ISSUE</h2>
          <p className="form-subtitle">Choose a report type, add a photo, and describe the issue.</p>

          <div className="section-label">YOUR NAME <span className="required">(Required)</span></div>
          <input
            id="field-name"
            type="text"
            className="email-input"
            placeholder="Juan Dela Cruz"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={100}
          />

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

          {selectedCategory && (
            <>
              <div className="section-label">SPECIFIC ISSUE <span className="required">(Required)</span></div>
              <select
                id="field-specific-issue"
                className="email-input"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
              >
                <option value="">Select the specific issue...</option>
                {SUB_CATEGORIES[selectedCategory].map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
              {subCategory === 'Other' && (
                <input
                  type="text"
                  className="email-input"
                  placeholder="Please specify the issue"
                  value={otherSubCategory}
                  onChange={(e) => setOtherSubCategory(e.target.value)}
                  maxLength={100}
                  style={{ marginTop: '8px' }}
                />
              )}
              </>
              )}

              {selectedCategory && (
                <>
                  <div className="section-label">TYPE OF AREA <span className="required">(Required)</span></div>
                  <p className="notify-note">This helps the team prepare the right equipment before heading to the site.</p>
                  <select
                    id="field-area-type"
                    className="email-input"
                    value={areaType}
                    onChange={(e) => setAreaType(e.target.value)}
                  >
                    <option value="">Select the type of area...</option>
                    {AREA_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  {areaType === 'Other' && (
                    <input
                      type="text"
                      className="email-input"
                      placeholder="Please specify the type of area"
                      value={otherAreaType}
                      onChange={(e) => setOtherAreaType(e.target.value)}
                      maxLength={100}
                      style={{ marginTop: '8px' }}
                    />
                  )}
                </>
              )}

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
            id="field-description"
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
            id="field-email"
            type="email"
            className="email-input"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="section-label">ADDRESS <span className="required">(Required)</span></div>
          <p className="notify-note">Enter the address of the issue. Start typing and pick a suggestion below, or use your current location.</p>
          <div className="address-autocomplete-wrapper">
            <input
              id="field-address"
              type="text"
              className="email-input"
              placeholder="e.g. Quezon Avenue, Ibabang Dupay, Lucena City"
              value={addressInput}
              onChange={(e) => handleAddressChange(e.target.value)}
              onFocus={() => { if (addressSuggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              autoComplete="off"
            />
            {searchingAddress && <div className="address-suggestions-status">Searching...</div>}
            {showSuggestions && addressSuggestions.length > 0 && (
              <ul className="address-suggestions-list">
                {addressSuggestions.map((place) => (
                  <li key={place.place_id} onMouseDown={() => handleSelectSuggestion(place)}>
                    {place.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="use-location-btn" onClick={handleUseCurrentLocation}>
            <PinIcon /> Use my current location instead
          </button>

          <div className="section-label">
            EXACT SPOT <span className="required">(Required)</span>
          </div>
          <p className="notify-note">
            If the address above is a large area (e.g. a subdivision or campus), tell us exactly where — e.g. "Beside the basketball court" or "Near Gate 2."
          </p>
          <input
            id="field-exact-spot"
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
      {showTour && (
        <OnboardingTour
          steps={TOUR_STEPS}
          onFinish={() => setShowTour(false)}
          storageKey="cityecomap_tour_seen_submit"
        />
      )}
    </div>
  );
}

export default SubmitReport;
