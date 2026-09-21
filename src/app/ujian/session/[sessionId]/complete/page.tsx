'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CompleteRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  useEffect(() => {
    if (sessionId) {
      router.replace(`/ujian/${sessionId}/selesai`);
    }
  }, [sessionId, router]);

  return (
    <div className="min-h-screen bg-surface-ground flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
