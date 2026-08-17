import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DriveLoading } from './components/drive-loading';
import { DriveScreen } from './components/drive-screen';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Drive',
  robots: { index: false, follow: false },
};

export default function DrivePage() {
  return (
    <Suspense fallback={<DriveLoading />}>
      <DriveScreen />
    </Suspense>
  );
}
