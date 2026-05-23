import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { AppLayout } from "../components/AppLayout";
import { Dashboard } from "../pages/Dashboard";
import { DetailsPage } from "../pages/Details";
import { DiscoverPage } from "../pages/Discover";
import { DiscoverSearchPage } from "../pages/DiscoverSearch";
import { Downloads } from "../pages/Downloads";
import { HealthPage } from "../pages/Health";
import { Library } from "../pages/Library";
import { Logs } from "../pages/Logs";
import { Profiles } from "../pages/Profiles";
import { ReleaseCalendarPage } from "../pages/ReleaseCalendar";
import { SearchPage } from "../pages/Search";
import { Settings } from "../pages/Settings";
import { SetupWizard } from "../pages/SetupWizard";
import { TasksPage } from "../pages/Tasks";
import { VfsBrowser } from "../pages/VfsBrowser";
import { LoginPage } from "../pages/Login";
import { LoadingState } from "../components/PageState";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RequireSetup({ children }: { children: ReactNode }) {
  const status = useQuery({ queryKey: ["setup-status"], queryFn: api.setupStatus, retry: false });
  if (status.isLoading) return <LoadingState />;
  if (status.data && !status.data.completed) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

function RedirectIfSetupComplete({ children }: { children: ReactNode }) {
  const status = useQuery({ queryKey: ["setup-status"], queryFn: api.setupStatus, retry: false });
  if (status.isLoading) return <LoadingState />;
  if (status.data?.completed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: "/setup",
    element: (
      <RedirectIfSetupComplete>
        <SetupWizard />
      </RedirectIfSetupComplete>
    )
  },
  {
    path: "/login",
    element: (
      <RequireSetup>
        <RedirectIfAuthenticated>
          <LoginPage />
        </RedirectIfAuthenticated>
      </RequireSetup>
    )
  },
  {
    path: "/",
    element: (
      <RequireSetup>
        <RequireAuth>
          <AppLayout />
        </RequireAuth>
      </RequireSetup>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "discover/search", element: <DiscoverSearchPage /> },
      { path: "discover/:mediaType", element: <DiscoverPage /> },
      { path: "details/:mediaType/:idSlug", element: <DetailsPage /> },
      { path: "details", element: <DetailsPage /> },
      { path: "requests", element: <Navigate to="/library" replace /> },
      { path: "search", element: <SearchPage /> },
      { path: "calendar", element: <ReleaseCalendarPage /> },
      { path: "downloads", element: <Downloads /> },
      { path: "health", element: <HealthPage /> },
      { path: "library", element: <Library /> },
      { path: "vfs", element: <VfsBrowser /> },
      { path: "profiles", element: <Profiles /> },
      { path: "tasks", element: <TasksPage /> },
      { path: "settings", element: <Settings /> },
      { path: "logs", element: <Logs /> }
    ]
  }
]);
