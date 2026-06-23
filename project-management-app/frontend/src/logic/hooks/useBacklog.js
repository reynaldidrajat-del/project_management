import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryStaleTimes } from '../../app/queryClient';
import { getApiErrorMessage } from '../services/api';
import { getBacklog, getBacklogStats } from '../services/backlogApi';

const EMPTY_BACKLOG_ISSUE_LIST = [];

const isMatchingProjectEvent = (payload, projectId) => !payload?.project_id || Number(payload.project_id) === Number(projectId);

const buildQueryReturn = (query, fallbackData) => ({
  error: query.error ? getApiErrorMessage(query.error) : '',
  loading: query.isLoading,
  refetch: async () => {
    const result = await query.refetch();
    return result.data;
  },
  refreshing: query.isFetching && !query.isLoading,
  ...fallbackData(query.data),
});

export const useBacklog = (projectId, filters = {}, options = {}) => {
  const enabled = (options.enabled ?? true) && Boolean(projectId);
  const filterKey = JSON.stringify(filters);
  const query = useQuery({
    enabled,
    gcTime: 5 * 60 * 1000,
    queryFn: () => getBacklog(projectId, filters),
    queryKey: ['backlog', projectId || 'none', filters],
    staleTime: queryStaleTimes.agileLists,
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleRealtimeBacklogEvent = (event) => {
      if (isMatchingProjectEvent(event.detail, projectId)) {
        query.refetch();
      }
    };

    window.addEventListener('realtime:sprint.changed', handleRealtimeBacklogEvent);
    window.addEventListener('realtime:task.updated', handleRealtimeBacklogEvent);
    window.addEventListener('realtime:automation.execution.created', handleRealtimeBacklogEvent);

    return () => {
      window.removeEventListener('realtime:sprint.changed', handleRealtimeBacklogEvent);
      window.removeEventListener('realtime:task.updated', handleRealtimeBacklogEvent);
      window.removeEventListener('realtime:automation.execution.created', handleRealtimeBacklogEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId || 'none', filterKey]);

  return buildQueryReturn(query, (data) => ({ issues: data || EMPTY_BACKLOG_ISSUE_LIST }));
};

export const useBacklogStats = (projectId, options = {}) => {
  const enabled = (options.enabled ?? true) && Boolean(projectId);
  const query = useQuery({
    enabled,
    gcTime: 5 * 60 * 1000,
    queryFn: () => getBacklogStats(projectId),
    queryKey: ['backlog-stats', projectId || 'none'],
    staleTime: queryStaleTimes.metrics,
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleRealtimeBacklogEvent = (event) => {
      if (isMatchingProjectEvent(event.detail, projectId)) {
        query.refetch();
      }
    };

    window.addEventListener('realtime:sprint.changed', handleRealtimeBacklogEvent);
    window.addEventListener('realtime:task.updated', handleRealtimeBacklogEvent);
    window.addEventListener('realtime:automation.execution.created', handleRealtimeBacklogEvent);

    return () => {
      window.removeEventListener('realtime:sprint.changed', handleRealtimeBacklogEvent);
      window.removeEventListener('realtime:task.updated', handleRealtimeBacklogEvent);
      window.removeEventListener('realtime:automation.execution.created', handleRealtimeBacklogEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId || 'none']);

  return buildQueryReturn(query, (data) => ({ stats: data || null }));
};
