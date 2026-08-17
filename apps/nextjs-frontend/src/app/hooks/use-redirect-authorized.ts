import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useRedirectAuthorized(hasSession: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (hasSession) {
      router.replace('/drive');
    }
  }, [hasSession, router]);
}
