import { createBrowserRouter } from "react-router-dom";
import { lazy } from "react";
import { AppLayout } from "../layouts/app-layout";
import { AuthLayout } from "../layouts/auth-layout";
import { ExtensionPage } from "../routes/extension-page";
import { ForbiddenPage, NotFoundPage, UnauthorizedPage } from "../routes/error-pages";
import { GuestRoute, ProtectedRoute, RoleRoute } from "../routes/route-guards";

const DashboardPage = lazy(async () => ({ default: (await import("../features/auth/dashboard-page")).DashboardPage }));
const LoginPage = lazy(async () => ({ default: (await import("../features/auth/login-page")).LoginPage }));
const ProfilePage = lazy(async () => ({ default: (await import("../features/auth/profile-page")).ProfilePage }));
const RegisterPage = lazy(async () => ({ default: (await import("../features/auth/register-page")).RegisterPage }));
const CustomerDetailPage = lazy(async () => ({ default: (await import("../features/customers/customer-detail-page")).CustomerDetailPage }));
const CustomersPage = lazy(async () => ({ default: (await import("../features/customers/customers-page")).CustomersPage }));
const DevicesPage = lazy(async () => ({ default: (await import("../features/devices/devices-page")).DevicesPage }));
const PartRequestsPage = lazy(async () => ({ default: (await import("../features/inventory/part-requests-page")).PartRequestsPage }));
const PartsPage = lazy(async () => ({ default: (await import("../features/parts/parts-page")).PartsPage }));
const InvoicesPage = lazy(async () => ({ default: (await import("../features/payments/invoices-page")).InvoicesPage }));
const InvoiceDetailPage = lazy(async () => ({ default: (await import("../features/payments/invoice-detail-page")).InvoiceDetailPage }));
const QuotationDetailPage = lazy(async () => ({ default: (await import("../features/quotations/quotation-detail-page")).QuotationDetailPage }));
const TicketCreatePage = lazy(async () => ({ default: (await import("../features/repair-tickets/ticket-create-page")).TicketCreatePage }));
const TicketDetailPage = lazy(async () => ({ default: (await import("../features/repair-tickets/ticket-detail-page")).TicketDetailPage }));
const TicketsPage = lazy(async () => ({ default: (await import("../features/repair-tickets/tickets-page")).TicketsPage }));
const UsersPage = lazy(async () => ({ default: (await import("../features/users/users-page")).UsersPage }));
const NotificationsPage = lazy(async () => ({ default: (await import("../features/notifications/notifications-page")).NotificationsPage }));
const ReportsPage = lazy(async () => ({ default: (await import("../features/reports/reports-page")).ReportsPage }));

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <GuestRoute><LoginPage /></GuestRoute> },
      { path: "/register", element: <GuestRoute><RegisterPage /></GuestRoute> },
    ],
  },
  {
    path: "/",
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "users", element: <RoleRoute roles={["ADMIN"]}><UsersPage /></RoleRoute> },
      { path: "customers", element: <RoleRoute roles={["RECEPTIONIST", "MANAGER"]}><CustomersPage /></RoleRoute> },
      { path: "customers/:customerId", element: <RoleRoute roles={["RECEPTIONIST", "MANAGER"]}><CustomerDetailPage /></RoleRoute> },
      { path: "devices", element: <RoleRoute roles={["CUSTOMER", "RECEPTIONIST", "MANAGER"]}><DevicesPage /></RoleRoute> },
      { path: "parts", element: <RoleRoute roles={["TECHNICIAN", "INVENTORY_STAFF", "MANAGER"]}><PartsPage /></RoleRoute> },
      { path: "part-requests", element: <RoleRoute roles={["TECHNICIAN", "INVENTORY_STAFF", "MANAGER"]}><PartRequestsPage /></RoleRoute> },
      { path: "invoices", element: <RoleRoute roles={["CUSTOMER", "CASHIER", "MANAGER"]}><InvoicesPage /></RoleRoute> },
      { path: "invoices/:invoiceId", element: <RoleRoute roles={["CUSTOMER", "CASHIER", "MANAGER"]}><InvoiceDetailPage /></RoleRoute> },
      { path: "tickets", element: <RoleRoute roles={["CUSTOMER", "RECEPTIONIST", "TECHNICIAN", "MANAGER"]}><TicketsPage /></RoleRoute> },
      { path: "tickets/new", element: <RoleRoute roles={["CUSTOMER", "RECEPTIONIST", "MANAGER"]}><TicketCreatePage /></RoleRoute> },
      { path: "tickets/:ticketId", element: <RoleRoute roles={["CUSTOMER", "RECEPTIONIST", "TECHNICIAN", "MANAGER"]}><TicketDetailPage /></RoleRoute> },
      { path: "tickets/:ticketId/quotations/:quotationId", element: <RoleRoute roles={["CUSTOMER", "TECHNICIAN", "MANAGER"]}><QuotationDetailPage /></RoleRoute> },
      { path: "extension", element: <RoleRoute roles={["CASHIER"]}><ExtensionPage /></RoleRoute> },
      { path: "reports", element: <RoleRoute roles={["MANAGER", "INVENTORY_STAFF"]}><ReportsPage /></RoleRoute> },
    ],
  },
  { path: "/unauthorized", element: <UnauthorizedPage /> },
  { path: "/forbidden", element: <ForbiddenPage /> },
  { path: "*", element: <NotFoundPage /> },
]);
