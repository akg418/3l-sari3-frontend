import { useState } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';

/** Confirms blocking a member. Cancel comes first, so it takes the initial focus. */
export const BlockUserModal = ({ user, onClose, onConfirm }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(user);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={Boolean(user)} onClose={onClose} title={`Block ${user?.username ?? ''}?`}>
      <div className="modal__body">
        <p>
          They will be removed from this channel and cannot rejoin, even with the password. You can
          unblock them later from the members panel.
        </p>

        <div className="modal__footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} isLoading={isSubmitting}>
            Block
          </Button>
        </div>
      </div>
    </Modal>
  );
};
