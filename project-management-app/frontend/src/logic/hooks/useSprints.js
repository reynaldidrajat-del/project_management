import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryStaleTimes } from '../../app/queryClient';
import { getApiErrorMessage } from '../services/api';
import { getActiveSprint, getSprintIssues, getSprintMetrics, getSprints } from '../services/sprintApi';

const isMatchingProjectEvent = (payload, projectId) => !payload?.project_id || Number(payload.project_id) === Number(projectId);

const isMatchingSprintEvent = (payload, sprintId) => {
  if (!payload) {
    return true;
  }

  const payloadSprintId = payload.sprint_id || payload.metadata?.sprint_id || payload.task?.sprint_id || payload.result?.sprint_id;
  return !payloadSprintId || Number(payloadSprintId) === Number(sprintId);
};

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

export const useSprints = (projectId, params = {}, options = {}) => {
  const enabled = (options.enabled ?? true) && Boolean(projectId);
  const paramsKey = JSON.stringify(params);
  const query = useQuery({
    enabled,
    queryFn: () => getSprints(projectId, params),
    queryKey: ['sprints', projectId || 'none', params],
    staleTime: queryStaleTimes.agileLists,
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleRealtimeSprintEvent = (event) => {
      if (isMatchingProjectEvent(event.detail, projectId)) {
        query.refetch();
      }
    };

    window.addEventListener('realtime:sprint.changed', handleRealtimeSprintEvent);

    return () => {
      window.removeEventListener('realtime:sprint.changed', handleRealtimeSprintEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId || 'none', paramsKey]);

  return buildQueryReturn(query, (data) => ({ sprints: data || [] }));
};

export const useActiveSprint = (projectId, options = {}) => {
  const enabled = (options.enabled ?? true) && Boolean(projectId);
  const query = useQuery({
    enabled,
    queryFn: () => getActiveSprint(projectId),
    queryKey: ['active-sprint', projectId || 'none'],
    staleTime: queryStaleTimes.agileLists,
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleRealtimeSprintEvent = (event) => {
      if (isMatchingProjectEvent(event.detail, projectId)) {
        query.refetch();
      }
    };

    window.addEventListener('realtime:sprint.changed', handleRealtimeSprintEvent);

    return () => {
      window.removeEventListener('realtime:sprint.changed', handleRealtimeSprintEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId || 'none']);

  return buildQueryReturn(query, (data) => ({ sprint: data || null }));
};

export const useSprintIssues = (sprintId, options = {}) => {
  const enabled = (options.enabled ?? true) && Boolean(sprintId);
  const query = useQuery({
    enabled,
    queryFn: () => getSprintIssues(sprintId),
    queryKey: ['sprint-issues', sprintId || 'none'],
    staleTime: queryStaleTimes.agileLists,
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleRealtimeSprintEvent = (event) => {
      if (isMatchingSprintEvent(event.detail, sprintId)) {
        query.refetch();
      }
    };

    window.addEventListener('realtime:sprint.changed', handleRealtimeSprintEvent);
    window.addEventListener('realtime:task.updated', handleRealtimeSprintEvent);
    window.addEventListener('realtime:automation.execution.created', handleRealtimeSprintEvent);

    return () => {
      window.removeEventListener('realtime:sprint.changed', handleRealtimeSprintEvent);
      window.removeEventListener('realtime:task.updated', handleRealtimeSprintEvent);
      window.removeEventListener('realtime:automation.execution.created', handleRealtimeSprintEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sprintId || 'none']);

  return buildQueryReturn(query, (data) => ({ issues: data || [] }));
};

export const useSprintMetrics = (sprintId, options = {}) => {
  const enabled = (options.enabled ?? true) && Boolean(sprintId);
  const query = useQuery({
    enabled,
    queryFn: () => getSprintMetrics(sprintId),
    queryKey: ['sprint-metrics', sprintId || 'none'],
    staleTime: queryStaleTimes.metrics,
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleRealtimeMetricEvent = (event) => {
      if (isMatchingSprintEvent(event.detail, sprintId)) {
        query.refetch();
      }
    };

    window.addEventListener('realtime:sprint.changed', handleRealtimeMetricEvent);
    window.addEventListener('realtime:task.updated', handleRealtimeMetricEvent);
    window.addEventListener('realtime:automation.execution.created', handleRealtimeMetricEvent);

    return () => {
      window.removeEventListener('realtime:sprint.changed', handleRealtimeMetricEvent);
      window.removeEventListener('realtime:task.updated', handleRealtimeMetricEvent);
      window.removeEventListener('realtime:automation.execution.created', handleRealtimeMetricEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sprintId || 'none']);

  return buildQueryReturn(query, (data) => ({ metrics: data || null }));
};
