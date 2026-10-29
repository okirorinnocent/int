import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, Eye, EyeOff, GraduationCap, KeyRound, LockKeyhole, ShieldCheck, UserRoundPlus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/access")({
  head: () => ({ meta: [{ title: "Sign in or create an account — InternLog" }] }),
  component: Access,
});

const passwordRules = [
  { label: "At least 12 characters", test: (value: string) => value.length >= 12 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "One number", test: (value: string) => /\d/.test(value) },
  { label: "One special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

function Access() {
  const navigate = useNavigate();
  const { allowSignup, register, login, setRole } = useApp();
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isRecovery, setIsRecovery] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("recovery") === "1");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passedRules = useMemo(() => passwordRules.filter((rule) => rule.test(password)).length, [password]);
  const strengthLabel = password.length === 0 ? "Not set" : passedRules <= 2 ? "Weak" : passedRules <= 4 ? "Getting stronger" : "Strong";

  const signUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!passwordRules.every((rule) => rule.test(password))) {
      toast.error("Please meet all password requirements.");
      return;
    }
    setBusy(true);
    try {
      // Self-registration is always student-only. The server/database must enforce this too.
      const result = await register(name.trim(), email.trim(), password, "student");
      if (!result.ok) {
        if (result.message?.startsWith("Check your email")) { toast.success(result.message); return; }
        return toast.error(result.message || "We couldn't create your account.");
      }
      localStorage.removeItem("internlog.demoMode");
      toast.success("Account created", { description: "Your student workspace is ready." });
      await navigate({ to: "/" });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.ok) return toast.error(result.message || "Unable to sign in. Check your details and try again.");
      localStorage.removeItem("internlog.demoMode");
      toast.success("Welcome back");
      await navigate({ to: "/" });
    } catch {
      toast.error("We couldn't sign you in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address first.");
      document.getElementById("login-email")?.focus();
      return;
    }
    if (!supabase) {
      toast.error("Password recovery is not configured yet. Connect Supabase Auth to enable secure recovery.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/access?recovery=1`,
      });
      if (error) throw error;
      setResetSent(true);
      // Use a generic confirmation to avoid exposing whether an email has an account.
      toast.success("If an account exists for that email, a recovery link is on its way.");
    } catch {
      toast.error("We couldn't start password recovery. Please try again shortly.");
    } finally {
      setBusy(false);
    }
  };

  const finishRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordRules.every((rule) => rule.test(password))) return toast.error("Please meet all password requirements.");
    if (password !== confirmPassword) return toast.error("The passwords do not match.");
    if (!supabase) return toast.error("Password recovery is not configured.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated", { description: "Sign in with your new password." });
      setIsRecovery(false); setPassword(""); setConfirmPassword(""); setMode("login");
      await navigate({ to: "/access", replace: true });
    } catch {
      toast.error("We couldn't update your password. Open the newest recovery email and try again.");
    } finally { setBusy(false); }
  };

  const tryDemo = () => {
    // Demo is intentionally a separate CTA, not part of the registration form.
    // The demo workspace should use seeded, non-sensitive data and student-level permissions only.
    localStorage.setItem("internlog.demoMode", "1");
    setRole("student");
    toast("Opening the demo workspace", { description: "Demo data is for evaluation only." });
    void navigate({ to: "/", search: { demo: "1" } as never });
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.10),transparent_45%),radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.10),transparent_42%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border bg-card shadow-xl lg:grid-cols-[0.92fr_1.08fr]">
        <section className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground"><GraduationCap className="size-6" /></div>
              <div><p className="font-display text-xl font-bold">InternLog</p><p className="text-xs text-sidebar-foreground/70">Internship management, made clear.</p></div>
            </div>
            <div className="mt-20 max-w-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/60">Your internship, organised</p>
              <h1 className="mt-4 font-display text-4xl font-semibold leading-tight">Make every week of your placement count.</h1>
              <p className="mt-5 leading-7 text-sidebar-foreground/75">Record your progress, build a clear evidence trail, and stay connected with your supervisors in one workspace.</p>
            </div>
            <div className="mt-10 space-y-4 text-sm">
              <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-sidebar-accent"><Check className="size-4" /></span>Keep daily work and learning in one logbook</div>
              <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-sidebar-accent"><Check className="size-4" /></span>Track hours, milestones, and feedback</div>
              <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-sidebar-accent"><Check className="size-4" /></span>Prepare a stronger internship report</div>
            </div>
          </div>
          <p className="text-xs text-sidebar-foreground/55">Built for students and the people who support their growth.</p>
        </section>

        <section className="p-5 sm:p-9 lg:p-10">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><GraduationCap className="size-5" /></div>
            <div><p className="font-display text-lg font-bold">InternLog</p><p className="text-xs text-muted-foreground">Your internship workspace</p></div>
          </div>
          <div className="mb-7">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground"><ShieldCheck className="size-3.5 text-primary" />Secure student access</div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{mode === "signup" ? "Start documenting your internship journey." : "Sign in to continue to your workspace."}</p>
          </div>

          {isRecovery ? <form className="flex flex-col gap-4" onSubmit={finishRecovery}>
            <div><h3 className="text-lg font-semibold">Choose a new password</h3><p className="mt-1 text-sm text-muted-foreground">Use a strong password you haven’t used elsewhere.</p></div>
            <div className="space-y-2"><Label htmlFor="recovery-password">New password</Label><Input id="recovery-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            <ul className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">{passwordRules.map((rule) => <li key={rule.label} className="flex items-center gap-1.5"><Check className={`size-3.5 ${rule.test(password) ? "text-emerald-600" : "text-muted-foreground/40"}`} />{rule.label}</li>)}</ul>
            <div className="space-y-2"><Label htmlFor="recovery-confirm">Confirm new password</Label><Input id="recovery-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Updating password…" : "Update password"}<ArrowRight className="ml-2 size-4" /></Button>
          </form> : <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="signup"><UserRoundPlus className="mr-2 size-4" />Create account</TabsTrigger><TabsTrigger value="login"><LockKeyhole className="mr-2 size-4" />Sign in</TabsTrigger></TabsList>
            <TabsContent value="signup">
              <form className="mt-6 flex flex-col gap-4" onSubmit={signUp} noValidate>
                <div className="space-y-2"><Label htmlFor="signup-name">Full name</Label><Input id="signup-name" autoComplete="name" placeholder="e.g. Amina Namusoke" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} aria-invalid={submitted && name.trim().length < 2} /></div>
                <div className="space-y-2"><Label htmlFor="signup-email">University email or personal email</Label><Input id="signup-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><Label htmlFor="signup-password">Create password</Label><span className={`text-xs font-medium ${passedRules === 5 ? "text-emerald-600" : passedRules >= 3 ? "text-amber-600" : "text-muted-foreground"}`}>{strengthLabel}</span></div>
                  <div className="relative"><Input id="signup-password" type={showPassword ? "text" : "password"} autoComplete="new-password" className="pr-11" placeholder="Create a strong password" value={password} onChange={(event) => setPassword(event.target.value)} required aria-describedby="password-hints" aria-invalid={submitted && passedRules !== 5} /><button type="button" onClick={() => setShowPassword((shown) => !shown)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
                  <div className="flex gap-1" aria-label={`Password strength: ${strengthLabel}`}><span className={`h-1.5 flex-1 rounded-full ${passedRules >= 1 ? "bg-rose-500" : "bg-muted"}`} /><span className={`h-1.5 flex-1 rounded-full ${passedRules >= 2 ? "bg-orange-500" : "bg-muted"}`} /><span className={`h-1.5 flex-1 rounded-full ${passedRules >= 3 ? "bg-amber-500" : "bg-muted"}`} /><span className={`h-1.5 flex-1 rounded-full ${passedRules >= 4 ? "bg-lime-600" : "bg-muted"}`} /><span className={`h-1.5 flex-1 rounded-full ${passedRules === 5 ? "bg-emerald-600" : "bg-muted"}`} /></div>
                  <ul id="password-hints" className="grid grid-cols-1 gap-1 pt-1 text-xs text-muted-foreground sm:grid-cols-2">{passwordRules.map((rule) => <li key={rule.label} className="flex items-center gap-1.5"><Check className={`size-3.5 ${rule.test(password) ? "text-emerald-600" : "text-muted-foreground/40"}`} />{rule.label}</li>)}</ul>
                </div>
                <div className="rounded-xl border bg-muted/35 p-3.5"><div className="flex items-start gap-3"><div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><GraduationCap className="size-4" /></div><div><p className="text-sm font-medium">Student workspace</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">New accounts are created as students. Supervisor and administrator access requires a verified invitation or approval.</p></div></div></div>
                <Button type="submit" className="mt-1 w-full" disabled={!allowSignup || busy}>{busy ? "Creating account…" : "Create student account"}<ArrowRight className="ml-2 size-4" /></Button>
                {!allowSignup && <p role="alert" className="text-sm text-destructive">Registration is temporarily disabled. Please contact your internship coordinator.</p>}
                <p className="text-center text-xs leading-relaxed text-muted-foreground">By creating an account, you agree to use InternLog responsibly and keep your sign-in details private.</p>
              </form>
            </TabsContent>
            <TabsContent value="login">
              <form className="mt-6 flex flex-col gap-4" onSubmit={signIn}>
                <div className="space-y-2"><Label htmlFor="login-email">Email address</Label><Input id="login-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
                <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="login-password">Password</Label><button type="button" onClick={forgotPassword} disabled={busy} className="text-xs font-medium text-primary underline-offset-4 hover:underline">Forgot password?</button></div><Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
                {resetSent && <p role="status" className="text-sm text-emerald-700">If an account exists for that email, you’ll receive a recovery link.</p>}
                <Button type="submit" className="mt-1 w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in to InternLog"}<ArrowRight className="ml-2 size-4" /></Button>
              </form>
              <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground"><KeyRound className="mt-0.5 size-4 shrink-0" />Never share your password or verification codes. InternLog staff will not ask you for them.</div>
            </TabsContent>
          </Tabs>}

          {!isRecovery && <><div className="my-7 flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">OR EXPLORE INTERNLOG</span><div className="h-px flex-1 bg-border" /></div>
          <div className="rounded-2xl border border-dashed p-4 sm:p-5"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><UsersRound className="size-5 text-muted-foreground" /></div><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">Try the demo workspace</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Explore sample logbook entries and dashboards. Demo data is separate from your account.</p><Button type="button" variant="outline" className="mt-3 w-full sm:w-auto" onClick={tryDemo}>Explore demo <ArrowRight className="ml-2 size-4" /></Button></div></div></div>
          <p className="mt-6 text-center text-xs text-muted-foreground">Need supervisor access? <Link to="/access" className="font-medium text-primary hover:underline" onClick={() => toast("Supervisor access is invitation-only", { description: "Contact your institution's internship coordinator for a verified invitation." })}>Request an invitation</Link></p></>}
        </section>
      </div>
    </main>
  );
}
