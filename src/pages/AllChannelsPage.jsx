import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/common/Button.jsx';
import { ChannelDirectory } from '../components/channels/ChannelDirectory.jsx';
import { ChannelFilters } from '../components/channels/ChannelFilters.jsx';
import { CreateChannelModal } from '../components/channels/CreateChannelModal.jsx';
import { useChannels } from '../context/ChannelsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { pluralize } from '../utils/format.js';

export const AllChannelsPage = () => {
  const {
    allChannels,
    filters,
    setFilters,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    error,
    create,
    quota,
  } = useChannels();

  const [isCreateOpen, setCreateOpen] = useState(false);
  const toast = useToast();
  const sentinelRef = useRef(null);

  /**
   * Infinite scroll: a sentinel below the grid asks for the next page as it
   * comes into view. The button underneath stays as an explicit fallback, for
   * keyboard users and for browsers without IntersectionObserver.
   */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: '300px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const handleCreate = async (payload) => {
    const channel = await create(payload);
    toast.success(`#${channel.name} is live for ${channel.durationMinutes} minutes.`);
    return channel;
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__title-group">
          <h1>All channels</h1>
          <p className="page-head__subtitle">
            {isLoading
              ? 'Looking for open channels…'
              : `${pluralize(allChannels.length, 'channel')}${hasMore ? '+' : ''} open right now.`}
          </p>
        </div>

        <Button
          onClick={() => setCreateOpen(true)}
          title={
            quota.canCreate
              ? undefined
              : `You already have ${quota.limit} active channels, the maximum.`
          }
        >
          New channel
          {quota.limit != null && (
            <span className="button__count">
              {quota.used}/{quota.limit}
            </span>
          )}
        </Button>
      </div>

      <ChannelFilters
        filters={filters}
        onChange={setFilters}
        resultCount={allChannels.length}
        isLoading={isLoading}
      />

      <ChannelDirectory
        channels={allChannels}
        isLoading={isLoading}
        error={error}
        emptyState={
          filters.search || filters.owner || filters.type
            ? {
                icon: '🔍',
                title: 'No channels match',
                message: 'Try a different name, another owner, or clear the filters.',
              }
            : {
                icon: '🌱',
                title: 'Nothing here yet',
                message: 'Create the first channel and invite someone before it expires.',
                action: <Button onClick={() => setCreateOpen(true)}>Create a channel</Button>,
              }
        }
      />

      {hasMore && !isLoading && (
        <div className="load-more">
          <div ref={sentinelRef} aria-hidden="true" />
          <Button variant="secondary" onClick={loadMore} isLoading={isLoadingMore}>
            {isLoadingMore ? 'Loading' : 'Load more channels'}
          </Button>
        </div>
      )}

      <CreateChannelModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        quota={quota}
      />
    </>
  );
};
