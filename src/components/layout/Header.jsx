import { Link, NavLink } from 'react-router-dom';
import { config } from '../../config.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useChannels } from '../../context/ChannelsContext.jsx';
import { initialsOf } from '../../utils/format.js';
import { Avatar } from '../common/Feedback.jsx';
import { Button } from '../common/Button.jsx';
import { ConnectionPill } from '../common/ConnectionPill.jsx';

const navLinkClass = ({ isActive }) =>
  `app-nav__link ${isActive ? 'app-nav__link--active' : ''}`.trim();

export const Header = () => {
  const { user, logout } = useAuth();
  const { myChannels, totalUnread } = useChannels();

  return (
    <header className="app-header">
      <Link to="/channels" className="app-logo">
        <span className="app-logo__mark" aria-hidden="true">
          3l
        </span>
        <span className="app-logo__label">{config.appName}</span>
      </Link>

      <nav className="app-nav" aria-label="Main">
        <NavLink to="/channels" className={navLinkClass}>
          All channels
        </NavLink>
        <NavLink to="/my-channels" className={navLinkClass}>
          My channels
          {totalUnread > 0 ? (
            <span
              className="unread-badge unread-badge--nav"
              title={`${totalUnread} unread ${totalUnread === 1 ? 'message' : 'messages'}`}
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          ) : (
            myChannels.length > 0 && <span className="app-nav__count">{myChannels.length}</span>
          )}
        </NavLink>
      </nav>

      <div className="app-user">
        <ConnectionPill />
        <Avatar initials={initialsOf(`${user?.firstName ?? ''} ${user?.lastName ?? ''}`)} />
        <span className="app-user__name">{user?.username}</span>
        <Button variant="ghost" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>
    </header>
  );
};
