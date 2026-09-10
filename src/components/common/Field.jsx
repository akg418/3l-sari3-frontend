import { useId } from 'react';

/**
 * Label, control and validation message wired together.
 *
 * The error is announced politely and linked with aria-describedby, so it is
 * not only a colour change.
 */
export const Field = ({ label, error, hint, children, htmlFor }) => {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>

      {children({
        id,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': describedBy || undefined,
      })}

      {hint && !error && (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

export const TextInput = ({ error, className = '', ...rest }) => (
  <input
    className={`input ${error ? 'input--invalid' : ''} ${className}`.trim()}
    {...rest}
  />
);
