import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Accessible dialog: closes on Escape or a backdrop click, moves focus to its
 * first control on open, and returns focus where it came from on close.
 */
export const Modal = ({ isOpen, onClose, title, subtitle, children, labelledBy }) => {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocused.current = document.activeElement;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    const focusTarget = dialogRef.current?.querySelector(
      'input, textarea, select, button:not(.modal__close)',
    );
    focusTarget?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? 'modal-title'}
        ref={dialogRef}
      >
        <div className="modal__header">
          <div>
            <h2 className="modal__title" id={labelledBy ?? 'modal-title'}>
              {title}
            </h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
};
