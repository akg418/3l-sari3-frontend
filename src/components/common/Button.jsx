const VARIANT_CLASS = {
  primary: '',
  secondary: 'button--secondary',
  ghost: 'button--ghost',
  danger: 'button--danger',
};

export const Button = ({
  children,
  variant = 'primary',
  size,
  block = false,
  isLoading = false,
  type = 'button',
  className = '',
  disabled,
  ...rest
}) => {
  const classes = [
    'button',
    VARIANT_CLASS[variant] ?? '',
    size === 'sm' ? 'button--sm' : '',
    block ? 'button--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || isLoading} {...rest}>
      {isLoading && <span className="button__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
};
