import { Avatar } from '../common/Feedback.jsx';
import { initialsOf, pluralize } from '../../utils/format.js';

/**
 * Who is in the channel.
 *
 * Two distinct things are shown: membership, which the server records, and
 * whether that person is connected right now, which the realtime layer
 * reports. Someone who has joined but closed their tab appears as a member who
 * is away, not as gone.
 */
export const MembersPanel = ({ members, onlineCount, isOpen, onClose }) => (
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
        </li>
      ))}

      {members.length === 0 && <li className="member__empty">Nobody here yet.</li>}
    </ul>
  </aside>
);
