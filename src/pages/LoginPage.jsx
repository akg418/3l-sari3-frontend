import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout.jsx';
import { Button } from '../components/common/Button.jsx';
import { Field, TextInput } from '../components/common/Field.jsx';
import { Alert } from '../components/common/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useForm } from '../hooks/useForm.js';
import { validateLogin } from '../utils/validation.js';
import { fieldErrorsFromError, messageForError } from '../utils/errorMessages.js';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Send the user back where they were headed before the redirect to sign in.
  const redirectTo = location.state?.from ?? '/channels';

  const form = useForm({
    initialValues: { username: '', password: '' },
    validate: validateLogin,
    onSubmit: async (values, { setErrors, setSubmitError }) => {
      try {
        await login({ username: values.username.trim(), password: values.password });
        navigate(redirectTo, { replace: true });
      } catch (error) {
        const fieldErrors = fieldErrorsFromError(error);
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        else setSubmitError(messageForError(error));
      }
    },
  });

  return (
    <AuthLayout
      title="Welcome back"
      tagline="Sign in to join a channel before it disappears."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={form.handleSubmit} noValidate>
        <Alert>{form.submitError}</Alert>

        <Field label="Username" error={form.touched.username ? form.errors.username : undefined}>
          {(fieldProps) => (
            <TextInput
              {...fieldProps}
              {...form.fieldProps('username')}
              autoComplete="username"
              autoFocus
              placeholder="john"
              error={form.touched.username ? form.errors.username : undefined}
            />
          )}
        </Field>

        <Field label="Password" error={form.touched.password ? form.errors.password : undefined}>
          {(fieldProps) => (
            <TextInput
              {...fieldProps}
              {...form.fieldProps('password')}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={form.touched.password ? form.errors.password : undefined}
            />
          )}
        </Field>

        <Button type="submit" block isLoading={form.isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
};
