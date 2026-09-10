import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const DEFAULT_DURATION_MS = 5000;

let toastId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    ({ title, message, variant = 'info', duration = DEFAULT_DURATION_MS, key }) => {
      toastId += 1;
      const id = `toast-${toastId}`;

      setToasts((current) => {
        // `key` collapses repeats: an expiry warning that arrives twice, or a
        // reconnect notice, should not stack up.
        const withoutDuplicate = key ? current.filter((toast) => toast.key !== key) : current;
        return [...withoutDuplicate, { id, key, title, message, variant }];
      });

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }

      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      push,
      info: (message, options) => push({ message, variant: 'info', ...options }),
      success: (message, options) => push({ message, variant: 'success', ...options }),
      warning: (message, options) => push({ message, variant: 'warning', ...options }),
      error: (message, options) => push({ message, variant: 'error', ...options }),
    }),
    [toasts, dismiss, push],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider');
  return context;
};
