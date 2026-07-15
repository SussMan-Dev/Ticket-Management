import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/api/api-error";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import type { Review } from "../../types/domain";

export interface ReviewInput {
  rating: number;
  technicianRating?: number | null;
  serviceRating?: number | null;
  comment?: string | null;
}

export function useReview(ticketId: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.review(ticketId),
    queryFn: async () => {
      try {
        return (await apiClient.get<Review>(`/repair-tickets/${ticketId}/review`)).data;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: ticketId > 0 && enabled,
  });
}

function useReviewMutation(ticketId: number, mutationFn: (input: ReviewInput) => Promise<Review>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.review(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketTimeline(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
    },
  });
}

export function useCreateReview(ticketId: number) {
  return useReviewMutation(ticketId, async (input) =>
    (await apiClient.post<Review>(`/repair-tickets/${ticketId}/review`, input)).data);
}

export function useUpdateReview(ticketId: number, reviewId: number) {
  return useReviewMutation(ticketId, async (input) =>
    (await apiClient.patch<Review>(`/reviews/${reviewId}`, input)).data);
}
