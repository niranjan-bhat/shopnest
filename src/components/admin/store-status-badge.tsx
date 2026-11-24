import { Badge } from '@/components/ui/badge';
import {
  TENANT_STATUS_LABEL,
  type TenantStatus,
} from '@/features/admin/store-list';

const VARIANT = {
  onboarding: 'outline',
  active: 'secondary',
  suspended: 'destructive',
} as const;

export function StoreStatusBadge({ status }: { status: TenantStatus }) {
  return (
    <Badge variant={VARIANT[status]} data-testid="store-status">
      {TENANT_STATUS_LABEL[status]}
    </Badge>
  );
}
