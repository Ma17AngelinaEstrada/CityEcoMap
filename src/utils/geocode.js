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
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const addr = data.address;

    const parts = [
      addr.road || addr.pedestrian || addr.footway,
      addr.suburb || addr.village || addr.neighbourhood,
      addr.city || addr.town || addr.municipality,
    ].filter(Boolean);

    const result = parts.length > 0 ? parts.join(', ') : data.display_name?.split(',').slice(0, 3).join(',').trim();
    cache[key] = result;
    saveCache(cache);
    return result;
  } catch (err) {
    return `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
  }
};