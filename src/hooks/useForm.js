import { useCallback, useState } from 'react';
import { compactErrors } from '../utils/validation.js';

/**
 * Small controlled-form helper: values, per-field errors, touched state and a
 * submit that validates first. Deliberately not a form library - the app has
 * three short forms and no need for one.
 */
export const useForm = ({ initialValues, validate, onSubmit }) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback(
    (field, value) => {
      setValues((current) => {
        const next = { ...current, [field]: value };
        // Errors are refreshed as the user types, but only for fields they
        // have already interacted with, so a pristine form stays quiet.
        if (validate) {
          const nextErrors = compactErrors(validate(next));
          setErrors((currentErrors) =>
            Object.fromEntries(
              Object.entries(nextErrors).filter(([key]) => touched[key] || currentErrors[key]),
            ),
          );
        }
        return next;
      });
      setSubmitError(null);
    },
    [validate, touched],
  );

  const handleBlur = useCallback(
    (field) => {
      setTouched((current) => ({ ...current, [field]: true }));
      if (!validate) return;
      const nextErrors = compactErrors(validate(values));
      setErrors((current) => ({ ...current, ...(nextErrors[field] ? { [field]: nextErrors[field] } : {}) }));
      if (!nextErrors[field]) {
        setErrors((current) => {
          const { [field]: _removed, ...rest } = current;
          return rest;
        });
      }
    },
    [validate, values],
  );

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault();
      setSubmitError(null);

      if (validate) {
        const nextErrors = compactErrors(validate(values));
        setTouched(Object.fromEntries(Object.keys(values).map((key) => [key, true])));

        if (Object.keys(nextErrors).length > 0) {
          setErrors(nextErrors);
          return;
        }
        setErrors({});
      }

      setIsSubmitting(true);
      try {
        await onSubmit(values, { setErrors, setSubmitError });
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit, validate, values],
  );

  return {
    values,
    errors,
    touched,
    submitError,
    isSubmitting,
    setValue,
    setValues,
    setErrors,
    setSubmitError,
    handleBlur,
    handleSubmit,
    fieldProps: (field) => ({
      value: values[field] ?? '',
      error: touched[field] ? errors[field] : undefined,
      onChange: (event) => setValue(field, event.target.value),
      onBlur: () => handleBlur(field),
    }),
  };
};
