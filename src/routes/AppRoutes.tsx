import { Suspense, lazy, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { AppLayout } from "../components/AppLayout";
import { LoadingState } from "../components/PageState";

const Dashboard = lazy(() => import("../pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const DetailsPage = lazy(() => import("../pages/Details").then((module) => ({ default: module.DetailsPage })));
const DiscoverPage = lazy(() => import("../pages/Discover").then((module) => ({ default: module.DiscoverPage })));
const DiscoverSearchPage = lazy(() => import("../pages/DiscoverSearch").then((module) => ({ default: module.DiscoverSearchPage })));
const Downloads = lazy(() => import("../pages/Downloads").then((module) => ({ default: module.Downloads })));
const HealthPage = lazy(() => import("../pages/Health").then((module) => ({ default: module.HealthPage })));
const Library = lazy(() => import("../pages/Library").then((module) => ({ default: module.Library })));
const ReleaseCalendarPage = lazy(() => import("../pages/ReleaseCalendar").then((module) => ({ default: module.ReleaseCalendarPage })));
const SearchPage = lazy(() => import("../pages/Search").then((module) => ({ default: module.SearchPage })));
const ServicesPage = lazy(() => import("../pages/Services").then((module) => ({ default: module.ServicesPage })));
const Settings = lazy(() => import("../pages/Settings").then((module) => ({ default: module.Settings })));
const SetupWizard = lazy(() => import("../pages/SetupWizard").then((module) => ({ default: module.SetupWizard })));
const VfsBrowser = lazy(() => import("../pages/VfsBrowser").then((module) => ({ default: module.VfsBrowser })));
const LoginPage = lazy(() => import("../pages/Login").then((module) => ({ default: module.LoginPage })));

function lazyElement(node: ReactNode) {
  return <Suspense fallback={<LoadingState />}>{node}</Suspense>;
}

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
  if (status.data?.completed) return <Navigate to="/services" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: "/setup",
    element: (
      <RedirectIfSetupComplete>
        {lazyElement(<SetupWizard />)}
      </RedirectIfSetupComplete>
    )
  },
  {
    path: "/login",
    element: (
      <RequireSetup>
        <RedirectIfAuthenticated>
          {lazyElement(<LoginPage />)}
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
      { path: "dashboard", element: lazyElement(<Dashboard />) },
      { path: "discover/search", element: lazyElement(<DiscoverSearchPage />) },
      { path: "discover/:mediaType", element: lazyElement(<DiscoverPage />) },
      { path: "details/:mediaType/:idSlug", element: lazyElement(<DetailsPage />) },
      { path: "details", element: lazyElement(<DetailsPage />) },
      { path: "requests", element: <Navigate to="/library" replace /> },
      { path: "search", element: lazyElement(<SearchPage />) },
      { path: "calendar", element: lazyElement(<ReleaseCalendarPage />) },
      { path: "downloads", element: lazyElement(<Downloads />) },
      { path: "health", element: lazyElement(<HealthPage />) },
      { path: "library", element: lazyElement(<Library />) },
      { path: "vfs", element: lazyElement(<VfsBrowser />) },
      { path: "profiles", element: <Navigate to="/settings?tab=quality" replace /> },
      { path: "tasks", element: <Navigate to="/settings?tab=tasks" replace /> },
      { path: "services", element: lazyElement(<ServicesPage />) },
      { path: "settings", element: lazyElement(<Settings />) },
      { path: "logs", element: <Navigate to="/settings?tab=logs" replace /> }
    ]
  }
]);
