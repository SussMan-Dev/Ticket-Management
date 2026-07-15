import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import type {
  RepairLog,
  TestResult,
  TestingCompletionResult,
  TestResultValue,
  TimelineEvent,
} from "../../types/domain";

export interface RepairLogInput {
  actionDescription: string;
  result?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  parts?: Array<{ partId: number; quantity: number }>;
}

export interface TestResultInput {
  testName: string;
  result: TestResultValue;
  note?: string | null;
}

export function useRepairLogs(ticketId: number) {
  return useQuery({
    queryKey: queryKeys.repairLogs(ticketId),
    queryFn: async () => (await apiClient.get<RepairLog[]>(
      `/repair-tickets/${ticketId}/repair-logs`,
    )).data,
    enabled: ticketId > 0,
  });
}

export function useTestResults(ticketId: number) {
  return useQuery({
    queryKey: queryKeys.testResults(ticketId),
    queryFn: async () => (await apiClient.get<TestResult[]>(
      `/repair-tickets/${ticketId}/test-results`,
    )).data,
    enabled: ticketId > 0,
  });
}

export function useTicketTimeline(ticketId: number) {
  return useQuery({
    queryKey: queryKeys.ticketTimeline(ticketId),
    queryFn: async () => (await apiClient.get<TimelineEvent[]>(
      `/repair-tickets/${ticketId}/timeline`,
    )).data,
    enabled: ticketId > 0,
  });
}

function useRepairActionMutation<TInput, TResult>(
  ticketId: number,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.repairLogs(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.testResults(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketTimeline(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(ticketId) }),
      ]);
    },
  });
}

export function useCreateRepairLog(ticketId: number) {
  return useRepairActionMutation(ticketId, async (input: RepairLogInput) =>
    (await apiClient.post<RepairLog>(
      `/repair-tickets/${ticketId}/repair-logs`,
      input,
    )).data);
}

export function useUpdateRepairLog(ticketId: number, repairLogId: number) {
  return useRepairActionMutation(ticketId, async (input: Partial<RepairLogInput>) =>
    (await apiClient.patch<RepairLog>(`/repair-logs/${repairLogId}`, input)).data);
}

export function useCreateTestResult(ticketId: number) {
  return useRepairActionMutation(ticketId, async (input: TestResultInput) =>
    (await apiClient.post<TestResult>(
      `/repair-tickets/${ticketId}/test-results`,
      input,
    )).data);
}

export function useCompleteTesting(ticketId: number) {
  return useRepairActionMutation(ticketId, async (reason?: string) =>
    (await apiClient.post<TestingCompletionResult>(
      `/repair-tickets/${ticketId}/complete-testing`,
      reason ? { reason } : {},
    )).data);
}
