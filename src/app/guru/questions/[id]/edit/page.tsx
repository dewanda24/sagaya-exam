'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function GuruQuestionsIdEditRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) {
      router.replace(`/guru/question-bank/${params.id}/edit`);
    }
  }, [params, router]);

  return null;
}
