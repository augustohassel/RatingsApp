import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreBadge } from './ScoreBadge';


describe('ScoreBadge', () => {
  it('renders score with formatting', () => {
    render(<ScoreBadge score={8.2} />);
    expect(screen.getByText('8.20')).toBeInTheDocument();
  });

  it('renders / 10 label when showLabel is true', () => {
    render(<ScoreBadge score={7.5} showLabel={true} />);
    expect(screen.getByText('7.50')).toBeInTheDocument();
    expect(screen.getByText('/ 10')).toBeInTheDocument();
  });
});

