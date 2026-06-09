import { Bug, Circle, ClipboardList, Layers, ListTodo } from 'lucide-react';

const ISSUE_TYPE_ICONS = {
  bug: Bug,
  epic: Layers,
  story: ClipboardList,
  subtask: ListTodo,
  task: ListTodo,
};

const getTintColor = (color) => {
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) {
    return `${color}14`;
  }

  return '#f8fafc';
};

function IssueTypeBadge({ issueType, name, icon, color, compact = false, className = '' }) {
  const resolvedName = issueType?.name || name;

  if (!resolvedName) {
    return null;
  }

  const resolvedIcon = (issueType?.icon || icon || resolvedName).toLowerCase();
  const resolvedColor = issueType?.color || color || '#64748B';
  const Icon = ISSUE_TYPE_ICONS[resolvedIcon] || Circle;

  return (
    <span
      className={[
        'inline-flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold',
        compact ? 'h-6 w-6 justify-center px-0' : '',
        className,
      ].join(' ')}
      style={{
        backgroundColor: getTintColor(resolvedColor),
        borderColor: resolvedColor,
        color: resolvedColor,
      }}
      title={resolvedName}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {compact ? null : <span className="truncate">{resolvedName}</span>}
    </span>
  );
}

export default IssueTypeBadge;
