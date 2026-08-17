'use client';

import Link from 'next/link';
import { AuthShell } from '@/app/components/auth-shell';
import { GuestOnly } from '@/app/components/guest-only';
import { useT } from '@/app/lib/i18n/use-t';
import { LoginForm } from './login-form';

export function LoginScreen() {
  const t = useT();

  return (
    <AuthShell title={t.auth.signInTitle} subtitle={t.auth.signInSubtitle}>
      <GuestOnly>
        <LoginForm />
        <p className="mt-6 text-sm text-muted">
          {t.auth.noAccount}{' '}
          <Link href="/register" className="font-medium text-accent hover:underline">
            {t.auth.createAccount}
          </Link>
        </p>
      </GuestOnly>
    </AuthShell>
  );
}
