import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomNav } from './BottomNav';


describe('BottomNav', () => {
  it('renders all 5 main navigation tabs', () => {
    const handleSelect = vi.fn();
    render(<BottomNav currentTab="dashboard" onSelectTab={handleSelect} />);

    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Evaluar')).toBeInTheDocument();
    expect(screen.getByText('Histórico')).toBeInTheDocument();
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
  });

  it('triggers onSelectTab with appropriate tab ID when clicked', () => {
    const handleSelect = vi.fn();
    render(<BottomNav currentTab="dashboard" onSelectTab={handleSelect} />);

    fireEvent.click(screen.getByText('Chat'));
    expect(handleSelect).toHaveBeenCalledWith('chat');

    fireEvent.click(screen.getByText('Evaluar'));
    expect(handleSelect).toHaveBeenCalledWith('evaluator');

    fireEvent.click(screen.getByText('Histórico'));
    expect(handleSelect).toHaveBeenCalledWith('history');

    fireEvent.click(screen.getByText('Ajustes'));
    expect(handleSelect).toHaveBeenCalledWith('settings');
  });
});

