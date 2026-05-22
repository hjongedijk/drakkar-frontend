import {
  Activity,
  Bell,
  CalendarDays,
  ClipboardList,
  Download,
  FileSearch,
  FolderTree,
  Gauge,
  HeartPulse,
  Library,
  LogOut,
  Menu,
  Moon,
  ScrollText,
  Sparkles,
  Settings,
  SlidersHorizontal,
  SunMedium,
  Triangle,
  UserRound,
  X
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useDownloadToasts } from "../hooks/useDownloadToasts";
import { cn } from "../lib/utils";
import { useTheme } from "../theme/ThemeProvider";
import { APP_NAME, APP_VERSION } from "../config";
import { Button } from "./ui/button";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/library", label: "Library", icon: Library },
  { to: "/search", label: "Search", icon: FileSearch },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/downloads", label: "Queue", icon: Download },
  { to: "/health", label: "Health", icon: HeartPulse },
  { to: "/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/profiles", label: "Quality", icon: SlidersHorizontal },
  { to: "/vfs", label: "Files", icon: FolderTree },
  { to: "/logs", label: "Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/setup", label: "Setup", icon: Sparkles },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  useDownloadToasts();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const mobilePrimaryItems = navItems.slice(0, 5);

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-14 border-r border-cyan-300/10 bg-slate-950/75 backdrop-blur-xl md:flex md:flex-col">
        <div className="grid h-16 place-items-center">
          <Triangle className="h-5 w-5 text-primary" />
        </div>
        <nav className="flex flex-1 flex-col items-center gap-2 py-4">
          {navItems.map((item) => (
            <NavLink
              key={`${item.to}-${item.label}`}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-white/10 hover:text-foreground",
                  isActive && "bg-white/15 text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-3 py-5">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <UserRound className="h-4 w-4 text-muted-foreground" />
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {(user?.displayName || "U").slice(0, 1).toUpperCase()}
          </span>
        </div>
      </aside>

      <div className="md:pl-14">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 bg-gradient-to-b from-background/95 to-background/35 px-4 backdrop-blur md:justify-center md:px-8">
          <button
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.055] text-foreground md:hidden"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative w-full max-w-xl">
            <FileSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-11 w-full rounded-2xl border border-cyan-300/10 bg-cyan-50/[0.045] px-11 text-sm font-semibold outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:bg-cyan-50/[0.075]"
              placeholder="Search movies, shows, people..."
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || !globalSearch.trim()) return;
                navigate(`/discover/search?q=${encodeURIComponent(globalSearch.trim())}`);
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-muted-foreground">^K</span>
          </div>
          <div className="absolute right-5 hidden items-center gap-3 text-sm text-muted-foreground lg:flex">
            <Activity className="h-4 w-4 text-emerald-500" />
            <span>Signal OK</span>
            <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Logout" onClick={() => void logout()} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1760px] min-w-0 overflow-x-hidden px-4 pb-28 pt-2 md:px-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition md:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileOpen(false)}
      >
        <div
          className={cn(
            "h-full w-[min(22rem,86vw)] border-r border-cyan-300/10 bg-background p-4 shadow-2xl transition-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10">
                <Triangle className="h-5 w-5 text-primary" />
              </span>
              <div>
                <p className="text-sm font-bold">{APP_NAME}</p>
                <p className="text-xs text-muted-foreground">v{APP_VERSION}</p>
              </div>
            </div>
            <button
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-muted-foreground"
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="grid gap-2">
            {navItems.map((item) => (
              <NavLink
                key={`${item.to}-${item.label}-mobile`}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-white/10 hover:text-foreground",
                    isActive && "bg-white/15 text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 flex gap-2">
            <Button className="flex-1" variant="outline" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
              {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button className="flex-1" variant="outline" onClick={() => void logout()} aria-label="Logout" title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-6 rounded-[1.35rem] border border-white/10 bg-black/80 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl md:hidden">
        {mobilePrimaryItems.map((item) => (
          <NavLink
            key={`${item.to}-${item.label}-bottom`}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "relative flex min-w-0 items-center justify-center rounded-2xl px-1 py-3 text-muted-foreground transition",
                isActive && "bg-white/15 text-foreground"
              )
            }
            aria-label={item.label}
            title={item.label}
          >
            {({ isActive }) => (
              <>
                <item.icon className="h-5 w-5" />
                <span className="sr-only">{item.label}</span>
                {isActive ? <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary" /> : null}
              </>
            )}
          </NavLink>
        ))}
        <button
          className="relative flex min-w-0 items-center justify-center rounded-2xl px-1 py-3 text-muted-foreground transition"
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="More navigation"
          title="More"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">More</span>
        </button>
      </nav>
    </div>
  );
}
