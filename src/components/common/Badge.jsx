const VARIANT_CLASS = {
  neutral: '',
  accent: 'badge--accent',
  warning: 'badge--warning',
  success: 'badge--success',
};

export const Badge = ({ children, variant = 'neutral', title }) => (
  <span className={`badge ${VARIANT_CLASS[variant] ?? ''}`.trim()} title={title}>
    {children}
  </span>
);
