import React, { createContext, useContext, useState, useCallback } from 'react';

const AdminTourContext = createContext(null);

export function AdminTourProvider({ children }) {
  const [tourSteps, setTourSteps] = useState([]);
  const [tourKey, setTourKey] = useState('cityecomap_admin_tour_seen');
  const [showTour, setShowTour] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Called by each admin page on mount to register its own tour steps
  const registerTour = useCallback((steps, storageKey) => {
    setTourSteps(steps);
    setTourKey(storageKey);
  }, []);

  return (
    <AdminTourContext.Provider
      value={{
        tourSteps, tourKey, showTour, setShowTour, registerTour,
        currentStepIndex, setCurrentStepIndex,
      }}
    >
      {children}
    </AdminTourContext.Provider>
  );
}

export function useAdminTour() {
  const ctx = useContext(AdminTourContext);
  if (!ctx) {
    throw new Error('useAdminTour must be used within an AdminTourProvider');
  }
  return ctx;
}