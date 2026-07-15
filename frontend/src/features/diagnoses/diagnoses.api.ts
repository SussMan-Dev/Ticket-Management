import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import type { Diagnosis } from "../../types/domain";

export interface DiagnosisInput {
  actualIssue: string;
  rootCause?: string | null;
  proposedSolution: string;
  laborCost: number;
  estimatedHours?: number | null;
  dataLossRisk: boolean;
  riskNote?: string | null;
  parts: Array<{ partId: number; quantity: number; note?: string | null }>;
}

export function useDiagnoses(ticketId: number) {
  return useQuery({
    queryKey: queryKeys.diagnoses(ticketId),
    queryFn: async () =>
      (await apiClient.get<Diagnosis[]>(`/repair-tickets/${ticketId}/diagnoses`)).data,
    enabled: Number.isInteger(ticketId) && ticketId > 0,
  });
}

function useDiagnosisMutation<TInput>(
  ticketId: number,
  mutationFn: (input: TInput) => Promise<Diagnosis>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.diagnoses(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(ticketId) }),
      ]);
    },
  });
}

export function useCreateDiagnosis(ticketId: number) {
  return useDiagnosisMutation(ticketId, async (input: DiagnosisInput) =>
    (await apiClient.post<Diagnosis>(`/repair-tickets/${ticketId}/diagnoses`, input)).data,
  );
}

export function useUpdateDiagnosis(ticketId: number, diagnosisId: number) {
  return useDiagnosisMutation(ticketId, async (input: Partial<DiagnosisInput>) =>
    (await apiClient.patch<Diagnosis>(`/diagnoses/${diagnosisId}`, input)).data,
  );
}

export function useSubmitDiagnosis(ticketId: number, diagnosisId: number) {
  return useDiagnosisMutation(ticketId, async (reason?: string) =>
    (await apiClient.post<Diagnosis>(`/diagnoses/${diagnosisId}/submit`, reason ? { reason } : {})).data,
  );
}

export function useApproveDiagnosis(ticketId: number, diagnosisId: number) {
  return useDiagnosisMutation(ticketId, async (reason?: string) =>
    (await apiClient.post<Diagnosis>(`/diagnoses/${diagnosisId}/approve`, reason ? { reason } : {})).data,
  );
}

export function useRequestDiagnosisRevision(ticketId: number, diagnosisId: number) {
  return useDiagnosisMutation(ticketId, async (reason: string) =>
    (await apiClient.post<Diagnosis>(`/diagnoses/${diagnosisId}/request-revision`, { reason })).data,
  );
}
