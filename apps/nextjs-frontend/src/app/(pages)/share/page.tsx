import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SITE_DESCRIPTION } from '@/lib/site';
import { ShareLoading } from './components/share-loading';
import { ShareScreen } from './components/share-screen';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shared',
  description: SITE_DESCRIPTION,
  robots: { index: false, follow: false },
};

export default function SharePage() {
  return (
    <Suspense fallback={<ShareLoading />}>
      <ShareScreen />
    </Suspense>
  );
}
