import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ChannelCard } from '../components/channels/ChannelCard.jsx';
import { resetClock, syncWithServer } from '../utils/serverClock.js';

const renderCard = (channel, props = {}) =>
  render(
    <MemoryRouter>
      <ChannelCard channel={channel} onJoin={vi.fn()} {...props} />
    </MemoryRouter>,
  );

const channelFixture = (overrides = {}) => ({
  id: '3f8a1c62-0000-4000-8000-000000000000',
  name: 'general',
  type: 'public',
  isPrivate: false,
  memberCount: 3,
  createdBy: { id: 'u1', username: 'john' },
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 12 * 60_000 + 43_000).toISOString(),
  durationMinutes: 30,
  isMember: false,
  ...overrides,
});

describe('ChannelCard', () => {
  afterEach(() => {
    cleanup();
    resetClock();
    vi.useRealTimers();
  });

  /**
   * The countdown floors to whole seconds, so wall-clock drift between
   * building the fixture and rendering would make the expected label flaky.
   */
  const withFrozenClock = (run) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    run();
  };

  it('shows the name, visibility and remaining lifetime', () => {
    withFrozenClock(() => renderCard(channelFixture()));

    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByText('3 members')).toBeInTheDocument();
    expect(screen.getByText('12:43')).toBeInTheDocument();
    expect(screen.getByText('remaining')).toBeInTheDocument();
  });

  it('marks a private channel with a lock and never renders a password', () => {
    const { container } = renderCard(
      channelFixture({ name: 'private-room', type: 'private', isPrivate: true }),
    );

    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(container.textContent).toContain('🔒');
    expect(container.textContent).not.toMatch(/password/i);
  });

  it('offers Join to a non-member and Open to a member', async () => {
    renderCard(channelFixture());
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();

    cleanup();
    renderCard(channelFixture({ isMember: true }));
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByText('Joined')).toBeInTheDocument();
  });

  it('asks to join when a non-member presses the button', async () => {
    const onJoin = vi.fn().mockResolvedValue(undefined);
    const channel = channelFixture();
    renderCard(channel, { onJoin });

    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(onJoin).toHaveBeenCalledWith(channel);
  });

  it('opens rather than re-joins for an existing member', async () => {
    const onJoin = vi.fn();
    const onOpen = vi.fn();
    renderCard(channelFixture({ isMember: true }), { onJoin, onOpen });

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(onOpen).toHaveBeenCalled();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('counts down against server time rather than the browser clock', () => {
    withFrozenClock(() => {
      // The browser is a full minute behind the server.
      syncWithServer(new Date(Date.now() + 60_000).toISOString());
      renderCard(channelFixture({ expiresAt: new Date(Date.now() + 3 * 60_000).toISOString() }));
    });

    // Two minutes of true remaining lifetime, not three.
    expect(screen.getByText('02:00')).toBeInTheDocument();
  });

  describe('ownership', () => {
    it('offers Leave to a member who is not the owner', () => {
      renderCard(channelFixture({ isMember: true, isOwner: false }), { onLeave: vi.fn() });
      expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
    });

    it('does not offer Leave to the owner, who cannot leave', () => {
      renderCard(channelFixture({ isMember: true, isOwner: true }), { onLeave: vi.fn() });

      expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument();
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    it('shows Joined rather than Owner for someone else\'s channel', () => {
      renderCard(channelFixture({ isMember: true, isOwner: false }));

      expect(screen.getByText('Joined')).toBeInTheDocument();
      expect(screen.queryByText('Owner')).not.toBeInTheDocument();
    });
  });

  describe('unread messages', () => {
    it('shows no badge when everything has been read', () => {
      const { container } = renderCard(channelFixture({ isMember: true, unreadCount: 0 }));
      expect(container.querySelector('.unread-badge')).toBeNull();
    });

    it('shows the number of unread messages', () => {
      renderCard(channelFixture({ isMember: true, unreadCount: 7 }));

      const badge = screen.getByTitle('7 unread messages');
      expect(badge).toHaveTextContent('7');
    });

    it('uses the singular for a single message', () => {
      renderCard(channelFixture({ isMember: true, unreadCount: 1 }));
      expect(screen.getByTitle('1 unread message')).toHaveTextContent('1');
    });

    it('caps the badge so a busy channel cannot stretch the card', () => {
      renderCard(channelFixture({ isMember: true, unreadCount: 250 }));

      const badge = screen.getByTitle('250 unread messages');
      expect(badge).toHaveTextContent('99+');
    });
  });

  it('flags a channel in its final minute', () => {
    let container;
    withFrozenClock(() => {
      ({ container } = renderCard(
        channelFixture({ expiresAt: new Date(Date.now() + 30_000).toISOString() }),
      ));
    });

    expect(container.querySelector('.countdown--critical')).not.toBeNull();
    expect(container.querySelector('.channel-card--expiring')).not.toBeNull();
  });
});
