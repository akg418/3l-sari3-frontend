import { useEffect } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Field, TextInput } from '../common/Field.jsx';
import { Alert } from '../common/Feedback.jsx';
import { useForm } from '../../hooks/useForm.js';
import { LIMITS, validateChannelForm } from '../../utils/validation.js';
import { fieldErrorsFromError, messageForError } from '../../utils/errorMessages.js';

const DURATION_PRESETS = [5, 15, 30, 60];

const emptyForm = { name: '', type: 'public', password: '', durationMinutes: 30 };

export const CreateChannelModal = ({ isOpen, onClose, onCreate, quota }) => {
  const atLimit = quota?.canCreate === false;
  const form = useForm({
    initialValues: emptyForm,
    validate: validateChannelForm,
    onSubmit: async (values, { setErrors, setSubmitError }) => {
      try {
        await onCreate({
          // An omitted name asks the server to generate one.
          ...(values.name.trim() ? { name: values.name.trim() } : {}),
          type: values.type,
          ...(values.type === 'private' ? { password: values.password } : {}),
          durationMinutes: Number(values.durationMinutes),
        });
        onClose();
      } catch (error) {
        const fieldErrors = fieldErrorsFromError(error);
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        else setSubmitError(messageForError(error));
      }
    },
  });

  // `setValues` comes from useState and is stable, so this resets the form when
  // the dialog opens and at no other time.
  const { setValues } = form;
  useEffect(() => {
    if (isOpen) setValues(emptyForm);
  }, [isOpen, setValues]);

  const isPrivate = form.values.type === 'private';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create a channel"
      subtitle="Channels delete themselves - along with every message - when their time runs out."
    >
      <form className="modal__body" onSubmit={form.handleSubmit}>
        <Alert>{form.submitError}</Alert>

        {atLimit ? (
          <div className="alert" role="alert">
            You already have {quota.limit} active channels, which is the maximum. Wait for one to
            expire, or leave one, and you can create another.
          </div>
        ) : (
          quota?.limit != null && (
            <p className="field__hint">
              {quota.remaining} of {quota.limit} channel slots left.
            </p>
          )
        )}

        <Field
          label="Name"
          error={form.touched.name ? form.errors.name : undefined}
          hint={`Optional. Leave blank and we will generate one. No spaces, cannot start with a number, up to ${LIMITS.CHANNEL_NAME_MAX} characters.`}
        >
          {(fieldProps) => (
            <TextInput
              {...fieldProps}
              {...form.fieldProps('name')}
              placeholder="general"
              autoComplete="off"
              maxLength={LIMITS.CHANNEL_NAME_MAX}
              error={form.touched.name ? form.errors.name : undefined}
            />
          )}
        </Field>

        <div className="field">
          <span className="field__label">Visibility</span>
          <div className="choice-group" role="group" aria-label="Channel visibility">
            <button
              type="button"
              className="choice"
              aria-pressed={!isPrivate}
              onClick={() => form.setValue('type', 'public')}
            >
              <span className="choice__title"># Public</span>
              <span className="choice__description">Anyone signed in can join.</span>
            </button>
            <button
              type="button"
              className="choice"
              aria-pressed={isPrivate}
              onClick={() => form.setValue('type', 'private')}
            >
              <span className="choice__title">🔒 Private</span>
              <span className="choice__description">Requires a password to join.</span>
            </button>
          </div>
        </div>

        {isPrivate && (
          <Field
            label="Channel password"
            error={form.touched.password ? form.errors.password : undefined}
            hint={`Between ${LIMITS.CHANNEL_PASSWORD_MIN} and ${LIMITS.CHANNEL_PASSWORD_MAX} characters. Share it with the people you want in.`}
          >
            {(fieldProps) => (
              <TextInput
                {...fieldProps}
                {...form.fieldProps('password')}
                type="password"
                autoComplete="new-password"
                maxLength={LIMITS.CHANNEL_PASSWORD_MAX}
                placeholder="••••••••"
                error={form.touched.password ? form.errors.password : undefined}
              />
            )}
          </Field>
        )}

        <Field
          label="Lifetime"
          error={form.touched.durationMinutes ? form.errors.durationMinutes : undefined}
          hint={`Between ${LIMITS.DURATION_MIN} and ${LIMITS.DURATION_MAX} minutes.`}
        >
          {(fieldProps) => (
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {DURATION_PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className="choice"
                    style={{ padding: 'var(--space-2) var(--space-3)', flex: '1 1 auto' }}
                    aria-pressed={Number(form.values.durationMinutes) === minutes}
                    onClick={() => form.setValue('durationMinutes', minutes)}
                  >
                    <span className="choice__title">{minutes} min</span>
                  </button>
                ))}
              </div>
              <TextInput
                {...fieldProps}
                {...form.fieldProps('durationMinutes')}
                type="number"
                inputMode="numeric"
                min={LIMITS.DURATION_MIN}
                max={LIMITS.DURATION_MAX}
                error={form.touched.durationMinutes ? form.errors.durationMinutes : undefined}
              />
            </div>
          )}
        </Field>

        <div className="modal__footer">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={form.isSubmitting} disabled={atLimit}>
            Create channel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
