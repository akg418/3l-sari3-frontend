import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout.jsx';
import { Button } from '../components/common/Button.jsx';
import { Field, TextInput } from '../components/common/Field.jsx';
import { Alert } from '../components/common/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useForm } from '../hooks/useForm.js';
import { LIMITS, validateRegistration } from '../utils/validation.js';
import { fieldErrorsFromError, messageForError } from '../utils/errorMessages.js';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const form = useForm({
    initialValues: { firstName: '', lastName: '', username: '', password: '' },
    validate: validateRegistration,
    onSubmit: async (values, { setErrors, setSubmitError }) => {
      try {
        await register({
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          username: values.username.trim(),
          password: values.password,
        });
        navigate('/channels', { replace: true });
      } catch (error) {
        const fieldErrors = fieldErrorsFromError(error);
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        else setSubmitError(messageForError(error));
      }
    },
  });

  return (
    <AuthLayout
      title="Create your account"
      tagline="It takes a moment. Channels do not last much longer."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={form.handleSubmit} noValidate>
        <Alert>{form.submitError}</Alert>

        <div className="auth-form__row">
          <Field label="First name" error={form.touched.firstName ? form.errors.firstName : undefined}>
            {(fieldProps) => (
              <TextInput
                {...fieldProps}
                {...form.fieldProps('firstName')}
                autoComplete="given-name"
                autoFocus
                placeholder="John"
                error={form.touched.firstName ? form.errors.firstName : undefined}
              />
            )}
          </Field>

          <Field label="Last name" error={form.touched.lastName ? form.errors.lastName : undefined}>
            {(fieldProps) => (
              <TextInput
                {...fieldProps}
                {...form.fieldProps('lastName')}
                autoComplete="family-name"
                placeholder="Doe"
                error={form.touched.lastName ? form.errors.lastName : undefined}
              />
            )}
          </Field>
        </div>

        <Field
          label="Username"
          error={form.touched.username ? form.errors.username : undefined}
          hint="At least 3 characters, no spaces, cannot start with a number."
        >
          {(fieldProps) => (
            <TextInput
              {...fieldProps}
              {...form.fieldProps('username')}
              autoComplete="username"
              maxLength={LIMITS.USERNAME_MAX}
              placeholder="john_doe"
              error={form.touched.username ? form.errors.username : undefined}
            />
          )}
        </Field>

        <Field
          label="Password"
          error={form.touched.password ? form.errors.password : undefined}
          hint={`At least ${LIMITS.PASSWORD_MIN} characters.`}
        >
          {(fieldProps) => (
            <TextInput
              {...fieldProps}
              {...form.fieldProps('password')}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              error={form.touched.password ? form.errors.password : undefined}
            />
          )}
        </Field>

        <Button type="submit" block isLoading={form.isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
};
