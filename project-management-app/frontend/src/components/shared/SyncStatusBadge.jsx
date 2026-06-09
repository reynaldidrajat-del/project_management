import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const statusConfig = {
  syncing: {
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    icon: Loader2,
    iconClassName: 'animate-spin',
    label: 'Syncing',
  },
  synced: {
    className: 'border-green-200 bg-green-50 text-green-700',
    icon: CheckCircle2,
    iconClassName: '',
    label: 'Synced',
  },
  failed: {
    className: 'border-red-200 bg-red-50 text-red-700',
    icon: AlertCircle,
    iconClassName: '',
    label: 'Failed',
  },
};

function SyncStatusBadge({ status, label, className = '' }) {
  const config = statusConfig[status];

  if (!config) {
    return null;
  }

  const Icon = config.icon;

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold',
        config.className,
        className,
      ].join(' ')}
    >
      <Icon className={['h-3.5 w-3.5', config.iconClassName].filter(Boolean).join(' ')} />
      {label || config.label}
    </span>
  );
}

export default SyncStatusBadge;
