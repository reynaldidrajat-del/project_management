import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '../../logic/services/api';
import { getActivities } from '../../logic/services/activityApi';

const formatActivityTime = (value) => {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

// Feed audit trail project agar user bisa melihat perubahan penting yang sudah dicatat backend.
function ProjectActivityFeed({ projectId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const fetchActivities = async () => {
      setLoading(true);
      setError('');

      try {
        const rows = await getActivities({ project_id: projectId, limit: 80 });

        if (active) {
          setActivities(rows);
        }
      } catch (err) {
        if (active) {
          setError(getApiErrorMessage(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (projectId) {
      fetchActivities();
    }

    return () => {
      active = false;
    };
  }, [projectId]);

  if (loading) {
    return <div className="card p-6 text-text-muted">Loading activity...</div>;
  }

  if (error) {
    return <div className="card p-6 text-danger">{error}</div>;
  }

  if (!activities.length) {
    return <div className="empty-state">Belum ada activity yang tercatat untuk project ini.</div>;
  }

  return (
    <div className="card overflow-hidden">
      <div className="section-header border-b border-border px-4 py-4">
        <div>
          <h2 className="section-title">Activity Feed</h2>
          <p className="section-subtitle">Audit trail perubahan project, task, bucket, approval, dan realisasi.</p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {activities.map((activity) => (
          <article key={activity.id} className="px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-dark">{activity.description || activity.action}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span>{activity.actor_name || 'System'}</span>
                  <span>•</span>
                  <span>{activity.action}</span>
                  {activity.task_title ? (
                    <>
                      <span>•</span>
                      <span className="max-w-[320px] truncate">{activity.task_title}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <time className="shrink-0 text-xs font-semibold text-text-muted" dateTime={activity.created_at}>
                {formatActivityTime(activity.created_at)}
              </time>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default ProjectActivityFeed;
