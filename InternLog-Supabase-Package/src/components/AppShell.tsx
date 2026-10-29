import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, NotebookPen, Bot, GraduationCap, Wifi, WifiOff, BriefcaseBusiness, UserRound, Bell, X, LogIn } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ROLE_LABELS, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/logbook", label: "Logbook", icon: NotebookPen },
  { to: "/assistant", label: "InternAI", icon: Bot },
  { to: "/vacancies", label: "Vacancies", icon: BriefcaseBusiness },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const navigate = useNavigate();
  const { online, currentUser, authReady, revalidateSession } = useApp();
  const [demoStored, setDemoStored] = useState(false);
  const demoMode = demoStored || searchStr.includes("demo=1");
  const [cookies, setCookies] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  useEffect(() => { setCookies(localStorage.getItem("internlog.cookies") !== "accepted"); if (path === "/access") { localStorage.removeItem("internlog.demoMode"); setDemoStored(false); } else { setDemoStored(localStorage.getItem("internlog.demoMode") === "1"); } }, [searchStr, path]);
  useEffect(() => {
    if (path !== "/access" && !demoMode) void revalidateSession().catch(() => undefined);
  }, [path, demoMode, revalidateSession]);
  useEffect(() => {
    if (authReady && path !== "/access" && !currentUser && !demoMode) void navigate({ to: "/access", replace: true });
  }, [path, currentUser, demoMode, authReady, navigate]);
  // The public access screen is deliberately rendered outside the authenticated application shell.
  if (path === "/access") return <>{children}</>;
  if (!authReady && path !== "/access") return <div className="grid min-h-screen place-items-center bg-background px-4 text-sm text-muted-foreground" role="status">Checking your secure session…</div>;
  if (!currentUser && !demoMode) return <div className="grid min-h-screen place-items-center bg-background px-4 text-sm text-muted-foreground" role="status">Taking you to secure sign in…</div>;
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar p-5 text-sidebar-foreground md:flex">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <p className="font-display text-base font-semibold text-sidebar-accent-foreground">InternLog</p>
            <p className="text-xs opacity-70">Students, supervisors &amp; staff</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}
              className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent",
                path === to && "bg-sidebar-accent text-sidebar-accent-foreground")}>
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-xl bg-sidebar-accent/70 p-3">
          <p className="text-xs uppercase tracking-wider opacity-60">Workspace access</p>
          <p className="mt-1 text-sm font-medium">{demoMode ? "Demo · Student" : ROLE_LABELS[currentUser?.role ?? "student"]}</p>
          <p className="mt-1 text-xs opacity-65">Roles are assigned through verified onboarding.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="size-4" /></div>
            <span className="font-display font-semibold">InternLog</span>
          </div>
          <div className="ml-auto flex items-center gap-2 md:ml-0"><Link to="/access" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"><LogIn className="size-4" />{currentUser ? currentUser.name.split(" ")[0] : "Create account / Sign in"}</Link>
            <div className="relative"><button className="relative rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell className="size-4" /><span className="absolute right-1 top-1 size-1.5 rounded-full bg-accent" /></button>{notificationsOpen && <div className="absolute right-0 top-12 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-card p-4 text-card-foreground shadow-card"><div className="flex items-center justify-between"><p className="font-semibold">Notifications</p><button aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}><X className="size-4" /></button></div><div className="mt-3 flex flex-col gap-3 text-sm"><p className="rounded-lg bg-muted p-3">Your profile is 80% complete. Add a photo to finish it.</p><p className="rounded-lg bg-muted p-3">You have a logbook entry waiting for review.</p><p className="rounded-lg bg-muted p-3">Remember to submit this week&apos;s hours.</p></div></div>}</div>
          <span className={cn("hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium md:inline-flex", 
            online ? "bg-accent-soft text-foreground" : "bg-warning-soft text-foreground")}>
            {online ? <Wifi className="size-3.5 text-accent" /> : <WifiOff className="size-3.5 text-warning" />}
            {online ? "Online" : "Offline — saving on this device"}
          </span>
          {demoMode && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">Demo mode</span>}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      {cookies && !demoMode && <div className="fixed inset-x-4 bottom-20 z-40 rounded-xl border bg-card p-4 shadow-card md:inset-x-auto md:bottom-6 md:left-6 md:max-w-md"><p className="text-sm font-semibold">Your privacy matters</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">We use essential cookies to keep InternLog secure and remember your preferences.</p><div className="mt-3 flex gap-2"><button className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground" onClick={() => { localStorage.setItem("internlog.cookies", "accepted"); setCookies(false); }}>Accept all</button><button className="rounded-md border px-3 py-2 text-xs font-medium" onClick={() => setCookies(false)}>Reject non-essential</button><button className="ml-auto text-xs font-medium text-accent" onClick={() => toast("Cookie preferences saved")}>Customize</button></div></div>}
      <nav aria-label="Workspace navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}
            className={cn("flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground",
              path === to && "text-accent")}>
            <Icon className="size-5" /> {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function StatusBadge({ status }: { status: import("@/lib/store").LogStatus }) {
  const styles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-secondary text-secondary-foreground ring-1 ring-border",
    approved: "bg-accent-soft text-foreground",
    changes: "bg-warning-soft text-foreground",
    feedback: "bg-accent text-accent-foreground",
  };
  const labels: Record<string, string> = { draft: "Draft", submitted: "Submitted", approved: "Approved", changes: "Changes requested", feedback: "Feedback given" };
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", styles[status])}>{labels[status]}</span>;
}
