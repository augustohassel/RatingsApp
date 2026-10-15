import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from './Header';


describe('Header', () => {
  it('renders default title and privacy status', () => {
    render(<Header />);
    expect(screen.getByText('RatingsApp')).toBeInTheDocument();
    expect(screen.getByText('100% Local y Privado')).toBeInTheDocument();
    expect(screen.getByText('v1.2.0')).toBeInTheDocument();
  });

  it('renders custom title and subtitle when provided', () => {
    render(<Header title="Historial Personal" subtitle="Desglose de semanas" />);
    expect(screen.getByText('Historial Personal')).toBeInTheDocument();
    expect(screen.getByText('Desglose de semanas')).toBeInTheDocument();
  });

  it('renders chat button when onOpenChat is supplied and calls handler on click', () => {
    const handleOpenChat = vi.fn();
    render(<Header onOpenChat={handleOpenChat} />);

    const chatBtn = screen.getByTitle('Abrir Chat Reflexivo');
    expect(chatBtn).toBeInTheDocument();
    fireEvent.click(chatBtn);
    expect(handleOpenChat).toHaveBeenCalledTimes(1);
  });
});

