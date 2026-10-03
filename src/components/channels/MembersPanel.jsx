import { Avatar } from '../common/Feedback.jsx';
import { Button } from '../common/Button.jsx';
import { initialsOf, pluralize } from '../../utils/format.js';

/**
 * Who is in the channel.
 *
 * Two distinct things are shown: membership, which the server records, and
 * whether that person is connected right now, which the realtime layer
 * reports. Someone who has joined but closed their tab appears as a member who
 * is away, not as gone.
 *
 * The owner additionally gets block / unblock controls. `onBlock` being absent
 * is what hides them.
 */
export const MembersPanel = ({
  members,
  onlineCount,
  isOpen,
  onClose,
  blocked = [],
  onBlock,
  onUnblock,
}) => (
  <aside className={`members ${isOpen ? 'members--open' : ''}`.trim()} aria-label="Channel members">
    <header className="members__head">
      <div>
        <h3 className="members__title">Members</h3>
        <p className="members__subtitle">
          {pluralize(members.length, 'member')} · {onlineCount} online
        </p>
      </div>
      <button type="button" className="members__close" onClick={onClose} aria-label="Hide members">
        &times;
      </button>
    </header>

    <ul className="members__list">
      {members.map((member) => (
        <li key={member.id} className="member">
          <span className={`member__presence ${member.isOnline ? 'member__presence--online' : ''}`.trim()}>
            <Avatar initials={initialsOf(member.displayName || member.username)} />
          </span>

          <div className="member__body">
            <span className="member__name">
              {member.username}
              {member.isOwner && (
                <span className="member__badge" title="Created this channel">
                  owner
                </span>
              )}
            </span>
            <span className="member__meta">{member.isOnline ? 'Online' : 'Away'}</span>
          </div>

          {onBlock && !member.isOwner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onBlock(member)}
              title={`Remove ${member.username} and stop them rejoining`}
            >
              Block
            </Button>
          )}
        </li>
      ))}

      {members.length === 0 && <li className="member__empty">Nobody here yet.</li>}
    </ul>

    {onUnblock && blocked.length > 0 && (
      <>
        <header className="members__head">
          <div>
            <h3 className="members__title">Blocked</h3>
            <p className="members__subtitle">{pluralize(blocked.length, 'user')}</p>
          </div>
        </header>
        <ul className="members__list">
          {blocked.map((user) => (
            <li key={user.id} className="member">
              <span className="member__presence">
                <Avatar initials={initialsOf(user.username)} />
              </span>
              <div className="member__body">
                <span className="member__name">{user.username}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onUnblock(user)}>
                Unblock
              </Button>
            </li>
          ))}
        </ul>
      </>
    )}
  </aside>
);
