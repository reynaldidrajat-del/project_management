import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatDate } from '../logic/helpers/dateHelper';
import { getApiErrorMessage } from '../logic/services/api';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../logic/services/notificationApi';
import { useUiStore } from '../store/uiStore';

const statusOptions = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
];

const getNotificationToneClass = (type) => {
  if (type === 'comment.mention') {
    return 'bg-blue-100 text-blue-700';
  }

  if (type === 'task.waiting_review') {
    return 'bg-amber-100 text-amber-700';
  }

  if (type === 'task.approved') {
    return 'bg-green-100 text-green-700';
  }

  if (type === 'chat.message') {
    return 'bg-violet-100 text-violet-700';
  }

  return 'bg-slate-100 text-slate-700';
};

function NotificationsPage() {
  const [status, setStatus] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const showToast = useUiStore((state) => state.showToast);

  const fetchNotifications = async () => {
    setLoading(true);

    try {
      const rows = await getNotifications(status === 'all' ? {} : { status });
      setNotifications(rows);
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    window.addEventListener('realtime:notification.created', fetchNotifications);

    return () => window.removeEventListener('realtime:notification.created', fetchNotifications);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleMarkRead = async (notification) => {
    if (notification.read_at) {
      return;
    }

    try {
      await markNotificationRead(notification.id);
      await fetchNotifications();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      await fetchNotifications();
      showToast({ type: 'success', message: 'Semua notifikasi ditandai terbaca.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Inbox</p>
          <h1 className="page-title">Notifications</h1>
          <p className="page-description">Mention, komentar task, assignment, dan approval request dalam satu pusat notifikasi.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={fetchNotifications}>
            Refresh
          </button>
          <button className="btn-primary" type="button" onClick={handleMarkAllRead}>
            Mark All Read
          </button>
        </div>
      </div>

      <div className="toolbar justify-between">
        <div className="segmented-control">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              className={['segmented-control-button', status === option.value ? 'bg-primary text-white' : 'text-text-muted hover:bg-slate-100'].join(' ')}
              type="button"
              onClick={() => setStatus(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {loading ? <span className="badge bg-slate-100 text-slate-700">Loading</span> : null}
      </div>

      <div className="card overflow-hidden">
        {notifications.length ? (
          notifications.map((notification) => (
            <article
              key={notification.id}
              className={[
                'border-b border-border px-4 py-3 transition last:border-b-0 hover:bg-slate-50',
                notification.read_at ? 'bg-white' : 'bg-blue-50/40',
              ].join(' ')}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`badge ${getNotificationToneClass(notification.type)}`}>{notification.type}</span>
                    {!notification.read_at ? <span className="badge bg-danger/10 text-danger">Unread</span> : null}
                    <span className="text-xs text-text-muted">{formatDate(notification.created_at, 'dd MMM yyyy HH:mm')}</span>
                  </div>
                  <h2 className="text-sm font-bold text-text-dark">{notification.title}</h2>
                  {notification.body ? <p className="mt-1 text-sm leading-6 text-text-muted">{notification.body}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                    {notification.project_name ? <span>Project: {notification.project_name}</span> : null}
                    {notification.task_title ? <span>Task: {notification.task_title}</span> : null}
                    {notification.actor_name ? <span>From: {notification.actor_name}</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {notification.project_id ? (
                    <Link className="btn-secondary" to={`/projects/${notification.project_id}`} onClick={() => handleMarkRead(notification)}>
                      Open
                    </Link>
                  ) : null}
                  {!notification.read_at ? (
                    <button className="btn-secondary" type="button" onClick={() => handleMarkRead(notification)}>
                      Mark Read
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="p-6 text-sm text-text-muted">Tidak ada notifikasi.</div>
        )}
      </div>
    </div>
  );
}

export default NotificationsPage;
