import type { Metadata } from 'next';
import { HomePage } from '@/app/components/home-page';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export default function Page() {
  return <HomePage />;
}
