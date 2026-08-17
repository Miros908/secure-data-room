import type { Metadata } from 'next';
import { SITE_DESCRIPTION } from '@/lib/site';
import { LoginScreen } from './components/login-screen';

export const metadata: Metadata = {
  title: 'Sign in',
  description: SITE_DESCRIPTION,
};

export default function LoginPage() {
  return <LoginScreen />;
}
