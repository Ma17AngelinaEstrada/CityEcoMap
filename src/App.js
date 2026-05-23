import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SplashScreen from './pages/citizen/SplashScreen';
import MapView from './pages/citizen/MapView';
import SubmitReport from './pages/citizen/SubmitReport';
import ReviewSubmit from './pages/citizen/ReviewSubmit';
import Confirmation from './pages/citizen/Confirmation';
import TrackReport from './pages/citizen/TrackReport';
import About from './pages/citizen/About';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/submit-report" element={<SubmitReport />} />
        <Route path="/review-report" element={<ReviewSubmit />} />
        <Route path="/confirmation" element={<Confirmation />} />
        <Route path="/track-report" element={<TrackReport />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Router>
  );
}

export default App;