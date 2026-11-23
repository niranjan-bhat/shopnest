import { cn } from 'cn';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL, type OrderStatus } from '@/features/orders/status';

// New orders stand out: they are waiting on the merchant.
const STYLE: Record<OrderStatus, string> = {
  pending:
    'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  confirmed:
    'border-transparent bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200',
  packed:
    'border-transparent bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200',
  shipped:
    'border-transparent bg-indigo-100 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-200',
  delivered:
    'border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200',
  cancelled: 'text-muted-foreground',
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(STYLE[status], className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
