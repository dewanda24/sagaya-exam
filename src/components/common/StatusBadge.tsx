'use client';

import { StatusBadge as UIStatusBadge } from '@/components/ui/Badge';

export type ParticipantStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'DISCONNECTED'
  | 'EXPIRED'
  | 'NOT_STARTED'
  | string;

export interface StatusBadgeProps {
  status: ParticipantStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <UIStatusBadge status={status} size="sm" />;
}

export default StatusBadge;
