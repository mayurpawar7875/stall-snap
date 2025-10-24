import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "./lib/auth";
import { AdminLayout } from "./components/AdminLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import MarketSelection from "./pages/MarketSelection";
import Punch from "./pages/Punch";
import Stalls from "./pages/Stalls";
import MediaUpload from "./pages/MediaUpload";
import Finalize from "./pages/Finalize";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AllSessions from "./pages/admin/AllSessions";
import Users from "./pages/admin/Users";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/market-selection" element={<ProtectedRoute><MarketSelection /></ProtectedRoute>} />
            <Route path="/punch" element={<ProtectedRoute><Punch /></ProtectedRoute>} />
            <Route path="/stalls" element={<ProtectedRoute><Stalls /></ProtectedRoute>} />
            <Route path="/media-upload" element={<ProtectedRoute><MediaUpload /></ProtectedRoute>} />
            <Route path="/finalize" element={<ProtectedRoute><Finalize /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/sessions" element={<ProtectedRoute><AdminLayout><AllSessions /></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><AdminLayout><Users /></AdminLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
