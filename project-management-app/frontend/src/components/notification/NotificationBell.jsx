import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';

import { getUnreadNotificationCount } from '../../logic/services/notificationApi';

// Tombol ringkas untuk membuka notification center dan melihat jumlah unread.
function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = async () => {
    try {
      const result = await getUnreadNotificationCount();
      setUnreadCount(Number(result?.unread_count || 0));
    } catch (_error) {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    refreshUnreadCount();
    const intervalId = window.setInterval(refreshUnreadCount, 45000);
    window.addEventListener('realtime:notification.created', refreshUnreadCount);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('realtime:notification.created', refreshUnreadCount);
    };
  }, []);

  return (
    <Link
      aria-label="Notifications"
      className="btn-secondary relative h-10 w-10 px-0"
      title="Notifications"
      to="/notifications"
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

export default NotificationBell;
