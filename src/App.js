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
import MonitoringDashboard from './pages/admin/MonitoringDashboard';
import RequireAdminRole from './pages/admin/RequireAdminRole';
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
          <Route path="/admin/dashboard" element={<RequireAdminRole allowedRoles={['Master Admin', 'CENRO Admin', 'City Engineering Admin']}><AdminTourProvider><AdminDashboard /></AdminTourProvider></RequireAdminRole>} />
          <Route path="/admin/reports" element={<RequireAdminRole allowedRoles={['Master Admin', 'CENRO Admin', 'City Engineering Admin']}><AdminTourProvider><ManageReports /></AdminTourProvider></RequireAdminRole>} />
          <Route path="/admin/export" element={<RequireAdminRole allowedRoles={['Master Admin', 'CENRO Admin', 'City Engineering Admin']}><AdminTourProvider><ExportReports /></AdminTourProvider></RequireAdminRole>} />
          <Route path="/admin/users" element={<RequireAdminRole allowedRoles={['Master Admin']}><AdminTourProvider><ManageUsers /></AdminTourProvider></RequireAdminRole>} />
          <Route
            path="/admin/monitoring"
            element={
              <RequireAdminRole allowedRoles={['Master Admin', 'EMB Admin']}>
                <AdminTourProvider>
                  <MonitoringDashboard />
                </AdminTourProvider>
              </RequireAdminRole>
            }
          />
          
        </Routes>
      </Router>
    </GoogleMapsProvider>
  );
}

export default App;