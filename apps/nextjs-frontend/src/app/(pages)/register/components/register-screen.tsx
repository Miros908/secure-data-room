'use client';

import Link from 'next/link';
import { AuthShell } from '@/app/components/auth-shell';
import { GuestOnly } from '@/app/components/guest-only';
import { useT } from '@/app/lib/i18n/use-t';
import { RegisterForm } from './register-form';

export function RegisterScreen() {
  const t = useT();

  return (
    <AuthShell title={t.auth.registerTitle} subtitle={t.auth.registerSubtitle}>
      <GuestOnly>
        <RegisterForm />
        <p className="mt-6 text-sm text-muted">
          {t.auth.hasAccount}{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            {t.auth.signIn}
          </Link>
        </p>
      </GuestOnly>
    </AuthShell>
  );
}
