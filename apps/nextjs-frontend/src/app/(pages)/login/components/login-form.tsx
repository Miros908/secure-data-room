'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginDto } from '@sdr/shared/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLogin } from '@/app/hooks/mutations/use-login';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { apiErrorMessage } from '@/lib/api-error-message';
import { applyApiIssues } from '@/lib/apply-api-issues';
import { useT } from '@/app/lib/i18n/use-t';

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const login = useLogin();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: () => router.replace('/drive'),
      onError: (error) => {
        if (!applyApiIssues(error, setError)) {
          setFormError(
            apiErrorMessage(error, {
              unauthorized: t.auth.wrongPassword,
            }),
          );
        }
      },
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <TextField
        id="login-email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        id="login-password"
        label={t.auth.password}
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />

      {formError ? (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <Button type="submit" isLoading={login.isPending}>
        {t.auth.signIn}
      </Button>
    </form>
  );
}
