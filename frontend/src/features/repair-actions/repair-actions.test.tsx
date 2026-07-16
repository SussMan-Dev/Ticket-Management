import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import type { RepairLog, TestResult } from "../../types/domain";
import {
  useCompleteTesting,
  useCreateRepairLog,
  useCreateTestResult,
} from "./repair-actions.api";
import { canWriteRepairLog } from "./repair-action.rules";

const repairLog: RepairLog = {
  id: 20,
  ticketId: 10,
  technician: { id: 6, fullName: "Technician" },
  actionDescription: "Replace display assembly",
  result: null,
  startedAt: "2026-07-15T00:00:00.000Z",
  finishedAt: null,
  parts: [],
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z",
};

const testResult: TestResult = {
  id: 30,
  ticketId: 10,
  testedBy: { id: 6, fullName: "Technician" },
  testName: "Display",
  result: "PASS",
  note: null,
  testedAt: "2026-07-15T01:00:00.000Z",
};

function wrapper(queryClient: QueryClient) {
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("Phase 8 frontend integration", () => {
  it("keeps repair logging available to technicians while parts are pending", () => {
    expect(canWriteRepairLog("TECHNICIAN", "WAITING_FOR_PARTS")).toBe(true);
    expect(canWriteRepairLog("TECHNICIAN", "REPAIRING")).toBe(true);
    expect(canWriteRepairLog("TECHNICIAN", "TESTING")).toBe(false);
    expect(canWriteRepairLog("MANAGER", "WAITING_FOR_PARTS")).toBe(false);
  });

  it("creates a ticket-scoped repair log and refreshes the timeline", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      success: true,
      message: "created",
      data: repairLog,
      meta: null,
    } as never);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateRepairLog(10), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        actionDescription: "Replace display assembly",
        parts: [{ partId: 4, quantity: 1 }],
      });
    });

    expect(post).toHaveBeenCalledWith("/repair-tickets/10/repair-logs", {
      actionDescription: "Replace display assembly",
      parts: [{ partId: 4, quantity: 1 }],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.repairLogs(10) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ticketTimeline(10) });
  });

  it("records a test result and refreshes ticket state/history", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      success: true,
      message: "tested",
      data: testResult,
      meta: null,
    } as never);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateTestResult(10), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ testName: "Display", result: "PASS" });
    });

    expect(post).toHaveBeenCalledWith("/repair-tickets/10/test-results", {
      testName: "Display",
      result: "PASS",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ticket(10) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ticketHistory(10) });
  });

  it("sends an optional completion reason to complete-testing", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      success: true,
      message: "completed",
      data: { outcome: "COMPLETED", ticketStatus: "COMPLETED" },
      meta: null,
    } as never);
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useCompleteTesting(10), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("All checks passed");
    });

    expect(post).toHaveBeenCalledWith("/repair-tickets/10/complete-testing", {
      reason: "All checks passed",
    });
  });
});
