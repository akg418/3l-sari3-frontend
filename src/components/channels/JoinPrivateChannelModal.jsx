import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Field, TextInput } from '../common/Field.jsx';
import { Alert } from '../common/Feedback.jsx';

/**
 * Password prompt for a private channel.
 *
 * The value is only ever sent to the server for verification; the client has no
 * way to check it and never tries to.
 */
export const JoinPrivateChannelModal = ({ channel, isOpen, onClose, onSubmit, error }) => {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setPassword('');
  }, [isOpen, channel?.id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!password) return;

    setIsSubmitting(true);
    try {
      await onSubmit(password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enter channel password"
      subtitle={channel ? `🔒 ${channel.name} is a private channel.` : undefined}
    >
      <form className="modal__body" onSubmit={handleSubmit}>
        <Alert>{error}</Alert>

        <Field label="Channel password">
          {(fieldProps) => (
            <TextInput
              {...fieldProps}
              type="password"
              autoComplete="off"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={error}
            />
          )}
        </Field>

        <div className="modal__footer">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={!password}>
            Join
          </Button>
        </div>
      </form>
    </Modal>
  );
};
