const CACHE_KEY = 'cityecomap_geocode_cache';

const loadCache = () => {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveCache = (cache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.error('Failed to save geocode cache:', err);
  }
};

let cache = loadCache();

const getKey = (lat, lng) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

export const isCached = (lat, lng) => {
  return Boolean(cache[getKey(lat, lng)]);
};

export const reverseGeocode = async (lat, lng) => {
  const key = getKey(lat, lng);
  if (cache[key]) return cache[key];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const addr = data.address;

    const parts = [
      addr.road || addr.pedestrian || addr.footway || addr.residential,
      addr.suburb || addr.village || addr.neighbourhood || addr.quarter || addr.hamlet,
      addr.city_district || addr.city || addr.town || addr.municipality,
    ].filter(Boolean);

    // Remove duplicate consecutive parts (e.g. suburb same as city)
    const uniqueParts = parts.filter((part, i) => part !== parts[i - 1]);

    let result;
    if (uniqueParts.length >= 2) {
      result = uniqueParts.join(', ');
    } else if (data.display_name) {
      // Fallback: use the first 3 meaningful segments of Nominatim's full display name
      result = data.display_name.split(',').slice(0, 3).map(s => s.trim()).join(', ');
    } else {
      result = uniqueParts.join(', ') || 'Location unavailable';
    }

    cache[key] = result;
    saveCache(cache);
    return result;
  } catch (err) {
    return `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
  }
};