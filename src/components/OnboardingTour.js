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
    let lastTop = null;

    const finalizeMeasurement = (el) => {
      if (cancelled) return;
      setTargetRect(el.getBoundingClientRect());
    };

    // Resets the 300ms "settle" timer — called both when the element's
    // size changes (ResizeObserver, e.g. async content loading) and when
    // its position changes (watchPosition, e.g. mid-scroll). Only once
    // NEITHER has changed for 300ms do we lock in the final rect.
    const scheduleSettle = (el) => {
      if (cancelled) return;
      clearTimeout(settleTimeout);
      settleTimeout = setTimeout(() => finalizeMeasurement(el), 300);
    };

    // Polls the element's position every frame during the scrollIntoView
    // animation. ResizeObserver alone doesn't fire on pure scrolling (no
    // size change), so without this, a smooth scroll that takes longer
    // than 300ms (common on mobile, or for targets deep in a long form)
    // gets measured mid-animation instead of at its final resting spot.
    const watchPosition = (el) => {
      const check = () => {
        if (cancelled) return;
        const rect = el.getBoundingClientRect();
        if (lastTop === null || Math.abs(rect.top - lastTop) > 0.5) {
          lastTop = rect.top;
          scheduleSettle(el);
        }
        rafId = requestAnimationFrame(check);
      };
      rafId = requestAnimationFrame(check);
    };

    const startObserving = (el) => {
      // Steps flagged "static" target fixed/absolute-positioned overlays
      // that never move on scroll (e.g. floating map controls). Skip the
      // scroll animation and settle-wait entirely — there's nothing to
      // wait for, and on heavy pages (Google Maps re-rendering) the
      // per-frame position polling below can visibly lag the transition.
      if (step.static) {
        finalizeMeasurement(el);
        return;
      }

      const elHeight = el.getBoundingClientRect().height;
      const scrollBlock = elHeight > window.innerHeight * 0.9 ? 'start' : 'center';
      el.scrollIntoView({ behavior: 'smooth', block: scrollBlock });

      resizeObserver = new ResizeObserver(() => scheduleSettle(el));
      resizeObserver.observe(el);

      watchPosition(el);
      scheduleSettle(el); // also settle if the element never moves or resizes at all
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