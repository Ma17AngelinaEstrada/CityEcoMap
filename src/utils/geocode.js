const cache = {};

export const reverseGeocode = async (lat, lng) => {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache[key]) return cache[key];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const addr = data.address;

    // Build readable address from available fields
    const parts = [
      addr.road || addr.pedestrian || addr.footway,
      addr.suburb || addr.village || addr.neighbourhood,
      addr.city || addr.town || addr.municipality,
    ].filter(Boolean);

    const result = parts.length > 0 ? parts.join(', ') : data.display_name?.split(',').slice(0, 3).join(',').trim();
    cache[key] = result;
    return result;
  } catch (err) {
    return `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
  }
};