import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SplashScreen from './pages/citizen/SplashScreen';
import MapView from './pages/citizen/MapView';
import SubmitReport from './pages/citizen/SubmitReport';
import ReviewSubmit from './pages/citizen/ReviewSubmit';
import Confirmation from './pages/citizen/Confirmation';
import TrackReport from './pages/citizen/TrackReport';
import About from './pages/citizen/About';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageReports from './pages/admin/ManageReports';
import ExportReports from './pages/admin/ExportReports';
import ManageUsers from './pages/admin/ManageUsers';
import { GoogleMapsProvider } from './context/GoogleMapsLoaderContext';
import { AdminTourProvider } from './context/AdminTourContext'

function App() {
  return (
    <GoogleMapsProvider>
      <Router>
        <Routes>
          <Route path="/" element={<SplashScreen />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/submit-report" element={<SubmitReport />} />
          <Route path="/review-report" element={<ReviewSubmit />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/track-report" element={<TrackReport />} />
          <Route path="/about" element={<About />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminTourProvider><AdminDashboard /></AdminTourProvider>} />
          <Route path="/admin/reports" element={<AdminTourProvider><ManageReports /></AdminTourProvider>} />
          <Route path="/admin/export" element={<AdminTourProvider><ExportReports /></AdminTourProvider>} />
          <Route path="/admin/users" element={<AdminTourProvider><ManageUsers /></AdminTourProvider>} />
          
        </Routes>
      </Router>
    </GoogleMapsProvider>
  );
}

export default App;