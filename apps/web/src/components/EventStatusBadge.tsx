import { EVENT_STATUS_LABEL, type EventStatus } from '@eventpass/shared';
import { Badge } from './ui';

const tone = { draft: 'neutral', published: 'success', closed: 'warning' } as const;

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={tone[status]}>{EVENT_STATUS_LABEL[status]}</Badge>;
}
