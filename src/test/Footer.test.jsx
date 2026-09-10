import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Footer } from '../components/layout/Footer.jsx';
import { config } from '../config.js';

describe('Footer', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows the copyright with the project name', () => {
    render(<Footer />);
    expect(screen.getByText(/All rights reserved/)).toHaveTextContent(config.appName);
  });

  it('uses the current year rather than a hardcoded one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-03-04T00:00:00.000Z'));

    render(<Footer />);

    expect(screen.getByText(/2031/)).toBeInTheDocument();
  });

  it('links to the portfolio', () => {
    render(<Footer />);

    const link = screen.getByRole('link', { name: 'portfolio-akg418.vercel.app' });
    expect(link).toHaveAttribute('href', 'https://portfolio-akg418.vercel.app');
  });

  it('opens the portfolio safely in a new tab', () => {
    render(<Footer />);

    const link = screen.getByRole('link', { name: 'portfolio-akg418.vercel.app' });
    expect(link).toHaveAttribute('target', '_blank');
    // Without noopener the new tab could reach back into this one.
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });
});
