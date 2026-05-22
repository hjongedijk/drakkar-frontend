import { Navigate, createBrowserRouter } from "react-router-dom";
import type { ReactNode } from "react";
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

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    )
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "discover/:mediaType", element: <DiscoverPage /> },
      { path: "discover/search", element: <DiscoverSearchPage /> },
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
      { path: "setup", element: <SetupWizard /> },
      { path: "logs", element: <Logs /> }
    ]
  }
]);
