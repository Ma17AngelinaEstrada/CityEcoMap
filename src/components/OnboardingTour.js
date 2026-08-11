import React, { useState, useEffect, useRef } from 'react';
import './OnboardingTour.css';

function OnboardingTour({ steps, onFinish }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const step = steps[stepIndex];
    if (!step) return;
    const el = document.querySelector(step.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTargetRect(null);
    }
  }, [stepIndex, steps]);

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      finishTour();
    }
  };

  const finishTour = () => {
    localStorage.setItem('cityecomap_tour_seen', 'true');
    onFinish();
  };

  const step = steps[stepIndex];
  if (!step) return null;

  const padding = 8;
  const spotlightStyle = targetRect
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  let tooltipStyle = {};
if (targetRect) {
  const spaceBelow = window.innerHeight - targetRect.bottom;
  if (spaceBelow > 160) {
    tooltipStyle = { top: targetRect.bottom + 16, right: 16 };
  } else {
    tooltipStyle = { top: Math.max(16, targetRect.top - 150), right: 16 };
  }
} else {
  tooltipStyle = { top: '40%', right: 16 };
}

  return (
    <div className="tour-overlay">
      {spotlightStyle && <div className="tour-spotlight" style={spotlightStyle}></div>}
      <div className="tour-tooltip" style={tooltipStyle} ref={tooltipRef}>
        <p className="tour-step-count">{stepIndex + 1} / {steps.length}</p>
        <h4 className="tour-tooltip-title">{step.title}</h4>
        <p className="tour-tooltip-desc">{step.description}</p>
        <div className="tour-tooltip-actions">
          <button className="tour-skip-btn" onClick={finishTour}>Skip Tour</button>
          <button className="tour-next-btn" onClick={handleNext}>
            {stepIndex < steps.length - 1 ? 'Next' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingTour;