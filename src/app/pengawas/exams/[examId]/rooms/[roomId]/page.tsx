'use client';

import { use } from 'react';
import ProctorLiveMonitoringPage from '../../monitoring/page';

export default function ExamRoomMonitoringSpecificPage({
  params,
}: {
  params: Promise<{ examId: string; roomId: string }>;
}) {
  const resolved = use(params);

  // Delegate directly to the master ProctorLiveMonitoringPage
  return (
    <ProctorLiveMonitoringPage
      params={Promise.resolve({ examId: resolved.examId })}
    />
  );
}
