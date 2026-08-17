'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterDto } from '@sdr/shared/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRegister } from '@/app/hooks/mutations/use-register';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { apiErrorMessage } from '@/lib/api-error-message';
import { applyApiIssues } from '@/lib/apply-api-issues';
import { useT } from '@/app/lib/i18n/use-t';

export function RegisterForm() {
  const t = useT();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const registerUser = useRegister();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterDto>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', name: '' },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    registerUser.mutate(values, {
      onSuccess: () => router.replace('/drive'),
      onError: (error) => {
        if (!applyApiIssues(error, setError)) {
          setFormError(apiErrorMessage(error));
        }
      },
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <TextField
        id="register-name"
        label={t.auth.name}
        autoComplete="name"
        placeholder={t.auth.namePlaceholder}
        error={errors.name?.message}
        {...register('name')}
      />
      <TextField
        id="register-email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        id="register-password"
        label={t.auth.password}
        type="password"
        autoComplete="new-password"
        placeholder={t.auth.passwordPlaceholder}
        error={errors.password?.message}
        {...register('password')}
      />

      {formError ? (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <Button type="submit" isLoading={registerUser.isPending}>
        {t.auth.createAccount}
      </Button>
    </form>
  );
}
