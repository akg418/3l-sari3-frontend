import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChannels } from '../context/ChannelsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { messageForError } from '../utils/errorMessages.js';

/**
 * The join flow, shared by every place a channel can be joined from.
 *
 * A public channel is joined immediately; a private one opens a password
 * prompt. Either way the server verifies the request - the modal is a
 * convenience, not a gate.
 */
export const useJoinChannel = () => {
  const { join } = useChannels();
  const navigate = useNavigate();
  const toast = useToast();

  const [pendingChannel, setPendingChannel] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  // Channels are addressed by name in the URL - the id never appears there.
  const openChannel = useCallback(
    (channel) => navigate(`/channels/${encodeURIComponent(channel.slug ?? channel.name)}`),
    [navigate],
  );

  const requestJoin = useCallback(
    async (channel) => {
      if (channel.isMember) {
        openChannel(channel);
        return;
      }

      if (channel.isPrivate) {
        setPasswordError(null);
        setPendingChannel(channel);
        return;
      }

      try {
        await join(channel.id);
        openChannel(channel);
      } catch (error) {
        toast.error(messageForError(error));
      }
    },
    [join, openChannel, toast],
  );

  const submitPassword = useCallback(
    async (password) => {
      if (!pendingChannel) return;

      try {
        await join(pendingChannel.id, password);
        setPendingChannel(null);
        openChannel(pendingChannel);
      } catch (error) {
        setPasswordError(messageForError(error));
      }
    },
    [join, openChannel, pendingChannel],
  );

  return {
    requestJoin,
    openChannel,
    passwordModal: {
      channel: pendingChannel,
      isOpen: Boolean(pendingChannel),
      error: passwordError,
      onClose: () => setPendingChannel(null),
      onSubmit: submitPassword,
    },
  };
};
