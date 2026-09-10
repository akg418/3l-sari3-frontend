import { useToast } from '../../context/ToastContext.jsx';

const VARIANT_CLASS = {
  info: '',
  success: 'toast--success',
  warning: 'toast--warning',
  error: 'toast--error',
};

/** Renders the toast queue. Live region so screen readers announce updates. */
export const ToastViewport = () => {
  const { toasts, dismiss } = useToast();

  return (
    <div className="toast-viewport" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${VARIANT_CLASS[toast.variant] ?? ''}`.trim()}>
          <div className="toast__body">
            {toast.title && <p className="toast__title">{toast.title}</p>}
            <p className="toast__message">{toast.message}</p>
          </div>
          <button
            type="button"
            className="toast__dismiss"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
};
