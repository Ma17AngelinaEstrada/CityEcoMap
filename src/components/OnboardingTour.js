import React, { useState, useEffect, useRef } from 'react';
import './OnboardingTour.css';

function OnboardingTour({ steps, onFinish, storageKey = 'cityecomap_tour_seen', onStepChange }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    onStepChange?.(stepIndex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

    useEffect(() => {
    const step = steps[stepIndex];
    if (!step) return;

    let rafId;
    let cancelled = false;
    let resizeObserver;
    let settleTimeout;

    const finalizeMeasurement = (el) => {
      if (cancelled) return;
      setTargetRect(el.getBoundingClientRect());
    };

    const startObserving = (el) => {
      const elHeight = el.getBoundingClientRect().height;
      const scrollBlock = elHeight > window.innerHeight * 0.9 ? 'start' : 'center';
      el.scrollIntoView({ behavior: 'smooth', block: scrollBlock });

      // Wait until the element's size hasn't changed for 300ms before
      // locking in its rect. ResizeObserver fires on every real size
      // change (e.g. a table growing as async data arrives), so this
      // correctly waits out both the scroll animation and any loading
      // content, regardless of which sibling component triggers it.
      const scheduleSettle = () => {
        if (cancelled) return;
        clearTimeout(settleTimeout);
        settleTimeout = setTimeout(() => finalizeMeasurement(el), 300);
      };

      resizeObserver = new ResizeObserver(scheduleSettle);
      resizeObserver.observe(el);
      scheduleSettle(); // also settle if the element's size never changes at all
    };

    const waitForElement = (attemptsLeft) => {
      if (cancelled) return;
      const el = document.querySelector(step.selector);

      if (!el) {
        if (attemptsLeft <= 0) {
          setTargetRect(null);
          return;
        }
        rafId = requestAnimationFrame(() => waitForElement(attemptsLeft - 1));
        return;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        if (attemptsLeft <= 0) {
          setTargetRect(null);
          return;
        }
        rafId = requestAnimationFrame(() => waitForElement(attemptsLeft - 1));
        return;
      }

      startObserving(el);
    };

    rafId = requestAnimationFrame(() => waitForElement(60));

    const handleResize = () => {
      const el = document.querySelector(step.selector);
      if (el) setTargetRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      clearTimeout(settleTimeout);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [stepIndex, steps]);

    const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      finishTour();
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  const finishTour = () => {
    localStorage.setItem(storageKey, 'true');
    onFinish();
  };

  const step = steps[stepIndex];
  if (!step) return null;

  const padding = 8;
  const spotlightStyle = targetRect
    ? (() => {
        const viewportH = window.innerHeight;
        const clampedTop = Math.max(targetRect.top - padding, 0);
        const clampedBottom = Math.min(targetRect.bottom + padding, viewportH);
        return {
          top: clampedTop,
          left: targetRect.left - padding,
          width: targetRect.width + padding * 2,
          height: Math.max(clampedBottom - clampedTop, 0),
        };
      })()
    : null;

  const TOOLTIP_H_ESTIMATE = 190;
  let tooltipStyle = {};
  if (targetRect) {
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - targetRect.bottom;
    const spaceAbove = targetRect.top;

    if (spaceBelow > TOOLTIP_H_ESTIMATE + 16) {
      tooltipStyle = { top: targetRect.bottom + 16, right: 16 };
    } else if (spaceAbove > TOOLTIP_H_ESTIMATE + 16) {
      tooltipStyle = { top: targetRect.top - TOOLTIP_H_ESTIMATE - 16, right: 16 };
    } else {
      // Neither side has room (small viewport / huge element) — pin inside bounds
      const clampedTop = Math.min(
        Math.max(16, targetRect.top),
        viewportH - TOOLTIP_H_ESTIMATE - 16
      );
      tooltipStyle = { top: clampedTop, right: 16 };
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
          <div className="tour-tooltip-nav-btns">
            {stepIndex > 0 && (
              <button className="tour-prev-btn" onClick={handlePrev}>Previous</button>
            )}
            <button className="tour-next-btn" onClick={handleNext}>
              {stepIndex < steps.length - 1 ? 'Next' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingTour;