import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button.jsx';
import { ChannelDirectory } from '../components/channels/ChannelDirectory.jsx';
import { ChannelFilters } from '../components/channels/ChannelFilters.jsx';
import { EMPTY_FILTERS, matchesFilters, useChannels } from '../context/ChannelsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { messageForError } from '../utils/errorMessages.js';
import { pluralize } from '../utils/format.js';

export const MyChannelsPage = () => {
  const { myChannels, isLoadingMine, errorMine, leave, quota } = useChannels();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const toast = useToast();

  /**
   * Filtered in the browser, unlike the public directory.
   *
   * This list is bounded by what one person has joined and is already loaded
   * in full, so a round trip per keystroke would buy nothing. The controls and
   * the behaviour are identical either way.
   */
  const visible = useMemo(
    () => myChannels.filter((channel) => matchesFilters(channel, filters)),
    [myChannels, filters],
  );

  const handleLeave = async (channel) => {
    try {
      await leave(channel.id);
      toast.info(`You left #${channel.name}.`);
    } catch (leaveError) {
      toast.error(messageForError(leaveError));
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__title-group">
          <h1>My channels</h1>
          <p className="page-head__subtitle">
            {isLoadingMine
              ? 'Loading your channels…'
              : `${pluralize(myChannels.length, 'channel')} you have joined, soonest to expire first.`}
            {!isLoadingMine && quota.limit != null && (
              <>
                {' '}
                You own {quota.used} of {quota.limit}.
              </>
            )}
          </p>
        </div>

        <Link to="/channels">
          <Button variant="secondary">Browse all channels</Button>
        </Link>
      </div>

      {myChannels.length > 0 && (
        <ChannelFilters
          filters={filters}
          onChange={setFilters}
          resultCount={visible.length}
          isLoading={false}
        />
      )}

      <ChannelDirectory
        channels={visible}
        isLoading={isLoadingMine}
        error={errorMine}
        onLeave={handleLeave}
        emptyState={
          myChannels.length > 0
            ? {
                icon: '🔍',
                title: 'No channels match',
                message: 'Try a different name, another owner, or clear the filters.',
              }
            : {
                icon: '🚪',
                title: 'You have not joined anything yet',
                message: 'Join a channel and it will show up here with its countdown.',
                action: (
                  <Link to="/channels">
                    <Button>Find a channel</Button>
                  </Link>
                ),
              }
        }
      />
    </>
  );
};
