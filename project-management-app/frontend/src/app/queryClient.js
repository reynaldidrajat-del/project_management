import { QueryClient } from '@tanstack/react-query';

export const queryStaleTimes = {
  agileLists: 30 * 1000,
  metrics: 20 * 1000,
  referenceData: 5 * 60 * 1000,
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: queryStaleTimes.agileLists,
    },
  },
});

export default queryClient;
