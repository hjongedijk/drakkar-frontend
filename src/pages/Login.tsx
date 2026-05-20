import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LockKeyhole, Moon, SunMedium, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../components/ToastProvider";
import { Button } from "../components/ui/button";
import { useTheme } from "../theme/ThemeProvider";

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#1e293b_0%,transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,1))] px-4 py-8 sm:py-10">
      <div className="w-full max-w-md space-y-6 rounded-3xl border bg-card/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Sign in</h1>
            <p className="mt-2 text-sm text-muted-foreground">Use the local admin account to access downloads, library, and settings.</p>
          </div>
          <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme" title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            try {
              await login(username, password);
              notify("Logged in.", "success");
              navigate("/dashboard", { replace: true });
            } catch (error) {
              notify(error instanceof Error ? error.message : "Login failed.", "error");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label className="block space-y-2 text-sm">
            <span className="text-muted-foreground">Username</span>
            <div className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-background/60 px-4">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <input className="w-full bg-transparent outline-none" value={username} onChange={(event) => setUsername(event.target.value)} />
            </div>
          </label>
          <label className="block space-y-2 text-sm">
            <span className="text-muted-foreground">Password</span>
            <div className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-background/60 px-4">
              <LockKeyhole className="h-4 w-4 text-muted-foreground" />
              <input className="w-full bg-transparent outline-none" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          </label>
          <Button className="w-full" type="submit" disabled={submitting || loading}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
          Initial local admin account: <span className="font-semibold">admin</span>. Enter the password manually and change it after first login.
        </div>
      </div>
    </div>
  );
}
