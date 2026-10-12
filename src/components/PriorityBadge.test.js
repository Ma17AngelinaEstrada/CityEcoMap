import { render, screen } from '@testing-library/react';
import PriorityBadge from './PriorityBadge';

test('shows the level', () => {
  render(<PriorityBadge level="High" />);
  expect(screen.getByText('High')).toBeInTheDocument();
});

test('compact version is labelled "Suggested:"', () => {
  render(<PriorityBadge level="Needs Assessment" compact />);
  expect(screen.getByText('Suggested:')).toBeInTheDocument();
  expect(screen.getByText('Needs Assessment')).toBeInTheDocument();
});

test('unknown level falls back safely instead of crashing', () => {
  render(<PriorityBadge level={undefined} />);
  expect(document.querySelector('.pb--na')).not.toBeNull();
});