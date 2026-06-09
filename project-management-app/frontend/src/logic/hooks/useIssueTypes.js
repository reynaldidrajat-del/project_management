import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryStaleTimes } from '../../app/queryClient';
import { getApiErrorMessage } from '../services/api';
import { getIssueTypeStats, getIssueTypes } from '../services/issueTypeApi';

const isMatchingIssueTypeProject = (payload, projectId) => {
  if (!projectId) {
    return !payload?.project_id;
  }

  return !payload?.project_id || Number(payload.project_id) === Number(projectId);
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

export const useIssueTypes = (projectId = null, options = {}) => {
  const enabled = options.enabled ?? true;
  const query = useQuery({
    enabled,
    queryFn: () => getIssueTypes(projectId),
    queryKey: ['issue-types', projectId || 'global'],
    staleTime: queryStaleTimes.referenceData,
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleRealtimeIssueTypeEvent = (event) => {
      if (isMatchingIssueTypeProject(event.detail, projectId)) {
        query.refetch();
      }
    };

    window.addEventListener('realtime:issue_type.changed', handleRealtimeIssueTypeEvent);

    return () => {
      window.removeEventListener('realtime:issue_type.changed', handleRealtimeIssueTypeEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId || 'global']);

  return buildQueryReturn(query, (data) => ({ issueTypes: data || [] }));
};

export const useIssueTypeStats = (projectId = null) => {
  const query = useQuery({
    queryFn: () => getIssueTypeStats(projectId),
    queryKey: ['issue-type-stats', projectId || 'global'],
    staleTime: queryStaleTimes.metrics,
  });

  useEffect(() => {
    const handleRealtimeIssueTypeEvent = (event) => {
      if (isMatchingIssueTypeProject(event.detail, projectId)) {
        query.refetch();
      }
    };

    window.addEventListener('realtime:issue_type.changed', handleRealtimeIssueTypeEvent);

    return () => {
      window.removeEventListener('realtime:issue_type.changed', handleRealtimeIssueTypeEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId || 'global']);

  return buildQueryReturn(query, (data) => ({ stats: data || [] }));
};
