import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CircularGauge } from './CircularGauge';


describe('CircularGauge', () => {
  it('renders score with two decimal places', () => {
    render(<CircularGauge score={8.25} />);
    expect(screen.getByText('8.25')).toBeInTheDocument();
    expect(screen.getByText('Nota Final')).toBeInTheDocument();
  });

  it('renders custom subtext when provided', () => {
    render(<CircularGauge score={9} subtext="Promedio Ponderado" />);
    expect(screen.getByText('Promedio Ponderado')).toBeInTheDocument();
  });

  it('hides subtext when showSubtext is false', () => {
    render(<CircularGauge score={7} showSubtext={false} />);
    expect(screen.queryByText('Nota Final')).not.toBeInTheDocument();
  });
});

