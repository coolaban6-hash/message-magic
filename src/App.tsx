import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

import Overview from "./pages/dashboard/Overview";
import SendSMS from "./pages/dashboard/SendSMS";
import Messages from "./pages/dashboard/Messages";
import Billing from "./pages/dashboard/Billing";
import SenderIDs from "./pages/dashboard/SenderIDs";
import APIKeys from "./pages/dashboard/APIKeys";
import Contacts from "./pages/dashboard/Contacts";

import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSenderIDs from "./pages/admin/AdminSenderIDs";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminLogs from "./pages/admin/AdminLogs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* User Dashboard */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><Overview /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/sms" element={<ProtectedRoute><DashboardLayout><SendSMS /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/messages" element={<ProtectedRoute><DashboardLayout><Messages /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/billing" element={<ProtectedRoute><DashboardLayout><Billing /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/sender-ids" element={<ProtectedRoute><DashboardLayout><SenderIDs /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/api" element={<ProtectedRoute><DashboardLayout><APIKeys /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard/contacts" element={<ProtectedRoute><DashboardLayout><Contacts /></DashboardLayout></ProtectedRoute>} />

            {/* Admin Dashboard */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><DashboardLayout><AdminOverview /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin><DashboardLayout><AdminUsers /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/sender-ids" element={<ProtectedRoute requireAdmin><DashboardLayout><AdminSenderIDs /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/payments" element={<ProtectedRoute requireAdmin><DashboardLayout><AdminPayments /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/logs" element={<ProtectedRoute requireAdmin><DashboardLayout><AdminLogs /></DashboardLayout></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
