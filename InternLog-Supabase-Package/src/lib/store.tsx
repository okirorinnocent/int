import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getDeviceId, supabase } from "@/lib/supabase";

export type Role = "student" | "workplace" | "academic" | "admin";
export const ROLE_LABELS: Record<Role, string> = { student: "Student", workplace: "Workplace Supervisor", academic: "Academic Supervisor", admin: "Administrator" };
export type LogStatus = "draft" | "submitted" | "approved" | "changes" | "feedback";
export const STATUS_LABELS: Record<LogStatus, string> = { draft: "Draft", submitted: "Submitted", approved: "Approved", changes: "Changes requested", feedback: "Feedback given" };
export interface LogEntry { id: string; date: string; week: number; tasks: string; skills: string; hours: number; status: LogStatus; feedback?: string; grade?: string; updatedAt: number; }
const SEED: LogEntry[] = [
  { id: "s1", date: "2026-10-12", week: 1, tasks: "Orientation at the ICT department. Set up development workstation and studied the network topology documentation.", skills: "Networking basics, documentation", hours: 8, status: "approved", feedback: "Good start.", grade: "A", updatedAt: 1 },
  { id: "s2", date: "2026-10-13", week: 1, tasks: "Assisted in configuring VLANs on Cisco switches for the finance office and tested connectivity.", skills: "Cisco IOS, VLANs", hours: 7, status: "approved", grade: "B+", updatedAt: 2 },
  { id: "s3", date: "2026-10-19", week: 2, tasks: "Built a small staff leave request form in React and connected it to a REST API.", skills: "React, REST APIs", hours: 8, status: "submitted", updatedAt: 3 },
  { id: "s4", date: "2026-10-20", week: 2, tasks: "Fixed bugs in the leave form validation and wrote notes on deployment.", skills: "Debugging, Git", hours: 6, status: "draft", updatedAt: 4 },
];
export interface ProfileData { name: string; email: string; phone: string; organisation: string; title: string; bio: string; photo: string; }
export interface UserAccount { id: string; name: string; email: string; role: Role; profile: ProfileData; }
export interface Application { id: string; vacancyId: string; vacancyTitle: string; company: string; status: "Pending" | "Under Review" | "Shortlisted" | "Accepted" | "Rejected"; note: string; attachment?: string; createdAt: number; }
const DEFAULT_PROFILE: ProfileData = { name: "Innocent Okiror", email: "innocent@example.com", phone: "+256 700 000 000", organisation: "Makerere University", title: "Computer Science student", bio: "Curious about building useful, reliable software.", photo: "" };
const DEFAULT_APPLICATIONS: Application[] = [{ id: "a1", vacancyId: "v2", vacancyTitle: "Network Support Intern", company: "Uganda Telecom", status: "Under Review", note: "", createdAt: 1 }];
interface Ctx { authReady: boolean; revalidateSession: () => Promise<void>; role: Role; setRole: (r: Role) => void; entries: LogEntry[]; upsert: (e: LogEntry) => void; remove: (id: string) => void; clearAll: () => void; profile: ProfileData; saveProfile: (p: ProfileData) => void; online: boolean; allowSignup: boolean; setAllowSignup: (v: boolean) => void; applications: Application[]; addApplication: (a: Application) => void; users: UserAccount[]; currentUser: UserAccount | null; register: (name: string, email: string, password: string, role: Role) => Promise<{ ok: boolean; message?: string }>; login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>; logout: () => void; }
const AppCtx = createContext<Ctx | null>(null);
const STORAGE = { entries: "internlog.entries.v1", profile: "internlog.profile", role: "internlog.role", signup: "internlog.allowSignup", applications: "internlog.applications", users: "internlog.users", current: "internlog.currentUser" };
export function AppProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(!supabase); const [role, setRoleState] = useState<Role>("student"); const [entries, setEntries] = useState<LogEntry[]>(SEED); const [profile, setProfile] = useState(DEFAULT_PROFILE); const [allowSignup, setAllowSignupState] = useState(true); const [online, setOnline] = useState(true); const [applications, setApplications] = useState<Application[]>(DEFAULT_APPLICATIONS); const [users, setUsers] = useState<UserAccount[]>([]); const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  useEffect(() => { try { const raw = localStorage.getItem(STORAGE.entries); if (raw) setEntries(JSON.parse(raw)); const savedProfile = localStorage.getItem(STORAGE.profile); if (savedProfile) setProfile(JSON.parse(savedProfile)); localStorage.removeItem(STORAGE.role); const signup = localStorage.getItem(STORAGE.signup); if (signup !== null) setAllowSignupState(signup !== "false"); const savedApps = localStorage.getItem(STORAGE.applications); if (savedApps) setApplications(JSON.parse(savedApps)); setUsers([]); setCurrentUser(null); localStorage.removeItem(STORAGE.users); localStorage.removeItem(STORAGE.current); } catch { /* safe defaults */ } if (!supabase) setAuthReady(true); setOnline(navigator.onLine); const on = () => setOnline(true); const off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession();
      const authUser = data.session?.user;
      if (!authUser) { if (alive) { setCurrentUser(null); localStorage.removeItem(STORAGE.current); setAuthReady(true); } return; }
      const { data: row } = await supabase.from("profiles").select("role,status,full_name,email").eq("id", authUser.id).maybeSingle();
      if (!alive) return;
      if (!row || row.status !== "active") { await supabase.auth.signOut(); setCurrentUser(null); localStorage.removeItem(STORAGE.current); setAuthReady(true); return; }
      const roleMap: Record<string, Role> = { student: "student", workplace_supervisor: "workplace", academic_supervisor: "academic", admin: "admin" };
      const role = roleMap[row.role] ?? "student"; const email = authUser.email ?? ""; const name = row.full_name || email;
      const nextProfile: ProfileData = { ...DEFAULT_PROFILE, name, email, title: ROLE_LABELS[role] };
      const user: UserAccount = { id: authUser.id, name, email, role, profile: nextProfile };
      setCurrentUser(user); setProfile(nextProfile); setRoleState(role); localStorage.setItem(STORAGE.current, JSON.stringify(user)); setAuthReady(true);
    };
    void restoreSession().catch(() => { if (alive) { setCurrentUser(null); setAuthReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        setCurrentUser(null); setRoleState("student"); localStorage.removeItem(STORAGE.current);
        if (alive) setAuthReady(true);
        return;
      }
      // Re-fetch role/status from the database after refresh, sign-in, user updates, and token refresh.
      if (["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "INITIAL_SESSION"].includes(event)) {
        queueMicrotask(() => { if (alive) void restoreSession().catch(() => {
          if (alive) { setCurrentUser(null); setRoleState("student"); localStorage.removeItem(STORAGE.current); }
        }); });
      }
    });
    const revalidateWhenVisible = () => {
      if (document.visibilityState === "visible" && alive) void restoreSession().catch(() => {
        if (alive) { setCurrentUser(null); setRoleState("student"); localStorage.removeItem(STORAGE.current); }
      });
    };
    window.addEventListener("focus", revalidateWhenVisible);
    document.addEventListener("visibilitychange", revalidateWhenVisible);
    return () => { alive = false; listener.subscription.unsubscribe(); window.removeEventListener("focus", revalidateWhenVisible); document.removeEventListener("visibilitychange", revalidateWhenVisible); };
  }, []);
    const revalidateSession = useCallback(async () => {
    if (!supabase) return;
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const authUser = sessionData.session?.user;
    if (sessionError || !authUser) { setCurrentUser(null); setRoleState("student"); localStorage.removeItem(STORAGE.current); return; }
    const { data: row, error } = await supabase.from("profiles").select("role,status,full_name,email").eq("id", authUser.id).maybeSingle();
    if (error || !row || row.status !== "active") {
      setCurrentUser(null); setRoleState("student"); localStorage.removeItem(STORAGE.current);
      await supabase.auth.signOut();
      return;
    }
    const roleMap: Record<string, Role> = { student: "student", workplace_supervisor: "workplace", academic_supervisor: "academic", admin: "admin" };
    const verifiedRole = roleMap[row.role];
    if (!verifiedRole) { setCurrentUser(null); setRoleState("student"); await supabase.auth.signOut(); return; }
    const email = authUser.email ?? ""; const name = row.full_name || email;
    const nextProfile: ProfileData = { ...DEFAULT_PROFILE, name, email, title: ROLE_LABELS[verifiedRole] };
    const user: UserAccount = { id: authUser.id, name, email, role: verifiedRole, profile: nextProfile };
    setCurrentUser(user); setProfile(nextProfile); setRoleState(verifiedRole); localStorage.setItem(STORAGE.current, JSON.stringify(user));
  }, []);
  const persist = (next: LogEntry[]) => { setEntries(next); localStorage.setItem(STORAGE.entries, JSON.stringify(next)); }; const setRole = (r: Role) => { setRoleState(r); }; const saveProfile = (p: ProfileData) => { setProfile(p); localStorage.setItem(STORAGE.profile, JSON.stringify(p)); if (currentUser) { const nextUser = { ...currentUser, name: p.name, profile: p }; setCurrentUser(nextUser); localStorage.setItem(STORAGE.current, JSON.stringify(nextUser)); } }; const setAllowSignup = (v: boolean) => { setAllowSignupState(v); localStorage.setItem(STORAGE.signup, String(v)); };
  const register = async (name: string, email: string, password: string, _accountRole: Role) => {
    if (!allowSignup) return { ok: false, message: "New account registration is currently disabled." };
    const strongPassword = password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !strongPassword) return { ok: false, message: "Enter a valid name and email, and use a password with at least 12 characters, uppercase and lowercase letters, a number, and a special character." };
    if (!supabase) return { ok: false, message: "Secure account registration is not configured. Connect Supabase Auth, or use the separate demo workspace." };
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password, options: { data: { full_name: name.trim(), name: name.trim(), role: "student", device_id: getDeviceId() } } });
    if (error) return { ok: false, message: error.message };
    if (!data.session || !data.user) return { ok: false, message: "Check your email for a confirmation link. After confirming, return here to sign in." };
    const nextProfile: ProfileData = { ...DEFAULT_PROFILE, name: name.trim(), email: cleanEmail, title: ROLE_LABELS.student };
    const user: UserAccount = { id: data.user.id, name: name.trim(), email: cleanEmail, role: "student", profile: nextProfile };
    setCurrentUser(user); setProfile(nextProfile); setRole("student");
    localStorage.removeItem(STORAGE.users); localStorage.setItem(STORAGE.current, JSON.stringify(user)); localStorage.setItem(STORAGE.profile, JSON.stringify(nextProfile));
    return { ok: true };
  };
  const login = async (email: string, password: string) => {
    if (!supabase) return { ok: false, message: "Secure sign-in is not configured. Connect Supabase Auth, or use the separate demo workspace." };
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.user) return { ok: false, message: error?.message.toLowerCase().includes("invalid") ? "Invalid email or password." : error?.message || "Unable to sign in." };
    const { data: profileRow, error: profileError } = await supabase.from("profiles").select("role,status,full_name,email").eq("id", data.user.id).maybeSingle();
    if (profileError || !profileRow) { await supabase.auth.signOut(); return { ok: false, message: "We couldn't verify this account's workspace. Contact your administrator." }; }
    if (profileRow.status !== "active") { await supabase.auth.signOut(); return { ok: false, message: "This account is pending verification or has been suspended. Contact your internship coordinator." }; }
    const roleMap: Record<string, Role> = { student: "student", workplace_supervisor: "workplace", academic_supervisor: "academic", admin: "admin" };
    const role = roleMap[profileRow.role] ?? "student";
    const cleanEmail = data.user.email ?? email.trim().toLowerCase();
    const userName = profileRow.full_name || data.user.user_metadata?.full_name || data.user.user_metadata?.name || cleanEmail;
    const nextProfile: ProfileData = { ...DEFAULT_PROFILE, name: userName, email: cleanEmail, title: ROLE_LABELS[role] };
    const user: UserAccount = { id: data.user.id, name: userName, email: cleanEmail, role, profile: nextProfile };
    setCurrentUser(user); setProfile(nextProfile); setRole(role);
    localStorage.removeItem(STORAGE.users); localStorage.setItem(STORAGE.current, JSON.stringify(user)); localStorage.setItem(STORAGE.profile, JSON.stringify(nextProfile));
    return { ok: true };
  }; const logout = () => { setCurrentUser(null); localStorage.removeItem(STORAGE.current); if (supabase) void supabase.auth.signOut(); };
  return <AppCtx.Provider value={{ authReady, revalidateSession, role, setRole, entries, online, profile, saveProfile, allowSignup, setAllowSignup, applications, addApplication: (a) => { const next = [a, ...applications]; setApplications(next); localStorage.setItem(STORAGE.applications, JSON.stringify(next)); }, users, currentUser, register, login, logout, upsert: (e) => { const exists = entries.some((x) => x.id === e.id); persist(exists ? entries.map((x) => x.id === e.id ? e : x) : [e, ...entries]); }, remove: (id) => persist(entries.filter((x) => x.id !== id)), clearAll: () => persist([]) }}>{children}</AppCtx.Provider>;
}
export function useApp() { const c = useContext(AppCtx); if (!c) throw new Error("useApp outside provider"); return c; }
export const REQUIRED_HOURS = 320;
export function verifiedHours(entries: LogEntry[]) { return entries.filter((e) => e.status === "approved").reduce((s, e) => s + e.hours, 0); }
