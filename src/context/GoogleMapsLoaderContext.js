import React, { createContext, useContext } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_LIBRARIES } from '../utils/googleMapsLibraries';

const GoogleMapsContext = createContext({ isLoaded: false });

export function GoogleMapsProvider({ children }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
    id: 'google-map-script',
  });
  return (
    <GoogleMapsContext.Provider value={{ isLoaded }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMapsLoaded() {
  return useContext(GoogleMapsContext);
}