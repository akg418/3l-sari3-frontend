import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChannelFilters } from '../components/channels/ChannelFilters.jsx';
import { EMPTY_FILTERS } from '../context/ChannelsContext.jsx';

const setup = (overrides = {}) => {
  const onChange = vi.fn();
  const props = { filters: EMPTY_FILTERS, onChange, resultCount: 0, isLoading: false, ...overrides };
  const view = render(<ChannelFilters {...props} />);
  return { onChange, view, props };
};

describe('ChannelFilters', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('exposes labelled controls for name, owner and visibility', () => {
    setup();
    expect(screen.getByLabelText('Search channels by name')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by owner username')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter by visibility' })).toBeInTheDocument();
  });

  it('debounces typing into one change rather than one per keystroke', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.type(screen.getByLabelText('Search channels by name'), 'general');

    // Nothing yet: the debounce has not elapsed.
    expect(onChange).not.toHaveBeenCalled();

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: 'general' }));
  });

  it('debounces the owner filter too', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.type(screen.getByLabelText('Filter by owner username'), 'ada');

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ owner: 'ada' }));
  });

  it('applies a visibility choice immediately', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.click(screen.getByRole('button', { name: '🔒 Private' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'private' }));
  });

  it('marks the active visibility', () => {
    setup({ filters: { ...EMPTY_FILTERS, type: 'public' } });

    expect(screen.getByRole('button', { name: '# Public' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports how many results the filters produced', () => {
    setup({ filters: { ...EMPTY_FILTERS, search: 'gen' }, resultCount: 3 });
    expect(screen.getByText('3 shown')).toBeInTheDocument();
  });

  it('says so when nothing matches', () => {
    setup({ filters: { ...EMPTY_FILTERS, search: 'zzz' }, resultCount: 0 });
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('offers no clear action until something is filtered', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('resets every control at once', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({
      filters: { search: 'gen', owner: 'ada', type: 'private' },
      resultCount: 1,
    });

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
    expect(screen.getByLabelText('Search channels by name')).toHaveValue('');
    expect(screen.getByLabelText('Filter by owner username')).toHaveValue('');
  });

  it('shows progress while a search is running', () => {
    setup({ filters: { ...EMPTY_FILTERS, search: 'gen' }, isLoading: true });
    expect(screen.getByText('Searching…')).toBeInTheDocument();
  });
});
