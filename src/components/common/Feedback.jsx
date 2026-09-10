export const Spinner = ({ label }) => (
  <div className="spinner-row">
    <span className="spinner" aria-hidden="true" />
    <span>{label ?? 'Loading…'}</span>
  </div>
);

export const Alert = ({ children }) =>
  children ? (
    <div className="alert" role="alert">
      {children}
    </div>
  ) : null;

export const EmptyState = ({ icon = '💬', title, message, action }) => (
  <div className="empty-state">
    <span className="empty-state__icon" aria-hidden="true">
      {icon}
    </span>
    <p className="empty-state__title">{title}</p>
    {message && <p>{message}</p>}
    {action}
  </div>
);

export const Avatar = ({ initials, size }) => (
  <span className={`avatar ${size === 'lg' ? 'avatar--lg' : ''}`.trim()} aria-hidden="true">
    {initials}
  </span>
);
