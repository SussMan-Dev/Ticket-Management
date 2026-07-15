import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { tokenStore } from "../lib/api/token-store";
import { resetMockQuotations } from "../features/quotations/quotation.gateway";
import { server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  tokenStore.clear();
  resetMockQuotations();
});
afterAll(() => server.close());
