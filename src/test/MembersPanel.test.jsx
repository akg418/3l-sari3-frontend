import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MembersPanel } from '../components/channels/MembersPanel.jsx';

const member = (overrides = {}) => ({
  id: `u-${overrides.username ?? 'x'}`,
  username: 'ada',
  displayName: 'Ada Lovelace',
  joinedAt: new Date().toISOString(),
  isOwner: false,
  isOnline: false,
  ...overrides,
});

describe('MembersPanel', () => {
  afterEach(cleanup);

  it('summarises how many members there are and how many are online', () => {
    render(
      <MembersPanel
        isOpen
        onlineCount={1}
        members={[member({ username: 'ada', isOnline: true }), member({ username: 'grace' })]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('2 members · 1 online')).toBeInTheDocument();
  });

  it('distinguishes a connected member from one who is away', () => {
    render(
      <MembersPanel
        isOpen
        onlineCount={1}
        members={[member({ username: 'ada', isOnline: true }), member({ username: 'grace' })]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('Away')).toBeInTheDocument();
  });

  it('marks the channel owner', () => {
    render(
      <MembersPanel
        isOpen
        onlineCount={0}
        members={[member({ username: 'ada', isOwner: true })]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTitle('Created this channel')).toHaveTextContent('owner');
  });

  it('shows an empty state rather than nothing at all', () => {
    render(<MembersPanel isOpen onlineCount={0} members={[]} onClose={vi.fn()} />);
    expect(screen.getByText('Nobody here yet.')).toBeInTheDocument();
  });

  it('can be dismissed', async () => {
    const onClose = vi.fn();
    render(<MembersPanel isOpen onlineCount={0} members={[member()]} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Hide members' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('never renders anything sensitive it was not given', () => {
    const { container } = render(
      <MembersPanel isOpen onlineCount={0} members={[member()]} onClose={vi.fn()} />,
    );

    expect(container.textContent).not.toMatch(/password/i);
  });
});
