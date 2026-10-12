import React from 'react';
import { PRIORITY_LEVELS } from '../utils/priorityRules';
import './PriorityBadge.css';

const LEVEL_CLASS = {
  [PRIORITY_LEVELS.CRITICAL]: 'critical',
  [PRIORITY_LEVELS.HIGH]: 'high',
  [PRIORITY_LEVELS.MEDIUM]: 'medium',
  [PRIORITY_LEVELS.LOW]: 'low',
  [PRIORITY_LEVELS.NEEDS_ASSESSMENT]: 'na',
};

// Outlined chip (not filled) so it is not mistaken for the status badges.
// "compact" adds the word "Suggested:" so the table/card chip is self-explanatory.
export default function PriorityBadge({ level, compact = false }) {
  const cls = LEVEL_CLASS[level] || 'na';
  return (
    <span className={`pb pb--${cls}${compact ? ' pb--compact' : ''}`} title={`Suggested priority: ${level}`}>
      <span className="pb-dot" aria-hidden="true" />
      {compact ? <span className="pb-kind">Suggested:</span> : null}
      <span className="pb-level">{level}</span>
    </span>
  );
}