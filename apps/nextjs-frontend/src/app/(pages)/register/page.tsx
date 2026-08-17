import type { Metadata } from 'next';
import { SITE_DESCRIPTION } from '@/lib/site';
import { RegisterScreen } from './components/register-screen';

export const metadata: Metadata = {
  title: 'Create account',
  description: SITE_DESCRIPTION,
};

export default function RegisterPage() {
  return <RegisterScreen />;
}
