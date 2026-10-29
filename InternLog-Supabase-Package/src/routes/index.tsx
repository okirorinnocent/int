import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BookOpenCheck, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, FileText, GraduationCap, Plus, Sparkles, Target, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/AppShell";
import { REQUIRED_HOURS, ROLE_LABELS, useApp, verifiedHours } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Dashboard — InternLog" },
    { name: "description", content: "Track internship hours, logbook approvals and progress in one place." },
    { property: "og:title", content: "InternLog — Internship Dashboard" },
    { property: "og:description", content: "AI-powered internship logbook and supervision platform for students and staff." },
  ] }),
  component: Dashboard,
});

function Metric({ icon: Icon, label, value, detail, tone = "blue", trend }: { icon: typeof Clock3; label: string; value: string | number; detail: string; tone?: "blue" | "green" | "amber" | "violet"; trend?: string }) {
  return <article className="metric-card">
    <div className="metric-top"><span className={`metric-icon ${tone}`}><Icon size={19} /></span>{trend && <span className="metric-trend"><ArrowUpRight size={13} />{trend}</span>}</div>
    <p className="metric-label">{label}</p><p className="metric-value">{value}</p><p className="metric-detail">{detail}</p>
  </article>;
}

function Dashboard() {
  const { role, entries, profile, applications } = useApp();
  const [serverDashboard, setServerDashboard] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    let active = true;
    if (!supabase) return;
    const load = async () => {
      const { data, error } = await supabase.rpc("get_dashboard");
      if (active && !error && data && typeof data === "object") setServerDashboard(data as Record<string, any>);
    };
    void load();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { void load(); });
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => { active = false; authListener.subscription.unsubscribe(); window.removeEventListener("focus", onFocus); };
  }, []);
  const localVerified = verifiedHours(entries);
  const verified = typeof serverDashboard?.verified_hours === "number" ? serverDashboard.verified_hours : localVerified;
  const pending = entries.filter((e) => e.status === "submitted");
  const approved = typeof serverDashboard?.approved_entries === "number" ? serverDashboard.approved_entries : entries.filter((e) => e.status === "approved").length;
  const progress = Math.min(100, Math.round((verified / (serverDashboard?.target_hours || REQUIRED_HOURS)) * 100));
  const weeks = Array.from({ length: Math.max(6, ...entries.map((e) => e.week)) }, (_, i) => i + 1).slice(-8);
  const serverWeeks = Array.isArray(serverDashboard?.weekly_hours) ? serverDashboard.weekly_hours : null;
  const chart = serverWeeks ? serverWeeks.slice(-8).map((item: { week: number; hours: number }) => ({ week: `W${item.week}`, hours: Number(item.hours) })) : weeks.map((week) => ({ week: `W${week}`, hours: entries.filter((e) => e.week === week && e.status === "approved").reduce((sum, e) => sum + e.hours, 0) }));
  const greeting = role === "student" ? `Good morning, ${profile.name.split(" ")[0] || "there"}` : role === "admin" ? "University overview" : "Supervision overview";
  const dateLabel = new Intl.DateTimeFormat("en-UG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return <div className="dashboard-page">
    <div className="page-heading">
      <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR INTERNSHIP WORKSPACE</div><h1>{greeting}</h1><p>Here&apos;s what&apos;s happening with your internship today.</p></div>
      <div className="heading-actions"><span className="today-chip"><CalendarDays size={15} />{dateLabel}</span><Button asChild className="primary-action"><Link to="/logbook"><Plus size={16} /> New log entry</Link></Button></div>
    </div>

    <section className="welcome-banner">
      <div className="welcome-copy"><div className="welcome-tag"><Sparkles size={14} /> YOUR PROGRESS, AT A GLANCE</div><h2>{role === "student" ? "Every day is a step forward." : "Make every placement count."}</h2><p>{role === "student" ? `You’ve completed ${verified} verified hours toward your ${REQUIRED_HOURS}-hour placement. Keep your logbook up to date and stay on track.` : `${pending.length} logbook ${pending.length === 1 ? "entry needs" : "entries need"} your attention. Keep students moving forward with timely reviews and feedback.`}</p><div className="banner-actions"><Button asChild variant="secondary"><Link to={role === "student" ? "/logbook" : "/logbook"}>{role === "student" ? "Continue logbook" : "Review entries"}<ArrowRight size={16}/></Link></Button><Link className="banner-text-link" to="/assistant">Explore InternAI <ArrowUpRight size={14}/></Link></div></div>
      <div className="banner-progress"><div className="progress-orbit"><div><strong>{role === "student" ? `${progress}%` : pending.length}</strong><span>{role === "student" ? "completed" : "to review"}</span></div></div><div className="banner-progress-copy"><strong>{role === "student" ? `${Math.max(0, REQUIRED_HOURS - verified)} hours to go` : "Your review queue"}</strong><span>{role === "student" ? `${verified} of ${REQUIRED_HOURS} verified hours` : "Review, approve, or send feedback"}</span></div></div>
      <div className="banner-decoration banner-decoration-one"/><div className="banner-decoration banner-decoration-two"/>
    </section>

    <div className="section-heading"><div><h2>At a glance</h2><p>Your placement metrics, all in one place.</p></div><span className="updated-label"><span/> Updated just now</span></div>
    <section className="metrics-grid">
      {role === "admin" ? <><Metric icon={Users} label="Active interns" value={serverDashboard?.active_interns ?? "—"} detail="Across all departments" tone="blue" trend="12%"/><Metric icon={BriefcaseBusiness} label="Host organisations" value={serverDashboard?.host_organizations ?? "—"} detail="Verified placement partners" tone="violet"/><Metric icon={Clock3} label="Pending reviews" value={pending.length} detail="Awaiting supervisor action" tone="amber"/><Metric icon={FileText} label="Logbook entries" value={serverDashboard?.approved_entries ?? entries.filter((e) => e.status === "approved").length} detail="Approved entries only" tone="green"/></> : <><Metric icon={Clock3} label="Verified hours" value={`${verified}h`} detail={`${Math.max(0, REQUIRED_HOURS - verified)} hours remaining`} tone="blue" trend={verified ? `${progress}%` : undefined}/><Metric icon={BookOpenCheck} label="Entries approved" value={approved} detail="Reviewed and signed off" tone="green"/><Metric icon={Clock3} label="Awaiting review" value={pending.length} detail="Submitted to your supervisor" tone="amber"/><Metric icon={Target} label="Placement progress" value={`${progress}%`} detail={`Of ${REQUIRED_HOURS} required hours`} tone="violet"/></>}
    </section>

    <section className="dashboard-main-grid">
      <article className="panel hours-panel"><div className="panel-heading"><div><h2>Hours logged</h2><p>Your weekly internship activity</p></div><span className="panel-icon"><TrendingUp size={18}/></span></div><div className="chart-summary"><div><span>Approved hours</span><strong>{verified} <small>hrs</small></strong></div><div className="chart-summary-note"><span className="chart-legend-dot"/> Hours per week</div></div><div className="hours-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ top: 12, right: 4, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 5" stroke="var(--border)" vertical={false}/><XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}/><YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} allowDecimals={false}/><Tooltip cursor={{ fill: "var(--muted)", radius: 8 }} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}/><Bar dataKey="hours" name="Hours" fill="var(--chart-1)" radius={[6,6,2,2]} maxBarSize={34}/></BarChart></ResponsiveContainer></div><div className="chart-footer"><span><span className="chart-legend-dot"/> Logged hours</span><span>Weekly overview</span></div></article>

      <article className="panel progress-panel"><div className="panel-heading"><div><h2>Placement goals</h2><p>Keep your momentum going</p></div><span className="panel-icon green"><Target size={18}/></span></div><div className="goal-number"><strong>{verified}</strong><span>/ {REQUIRED_HOURS} hrs</span></div><Progress value={progress} className="goal-progress"/><div className="goal-meta"><span>{progress}% complete</span><span>{Math.max(0, REQUIRED_HOURS - verified)} hrs left</span></div><div className="goal-divider"/><div className="goal-milestones"><div className="milestone-row"><span className="milestone-check"><CheckCircle2 size={15}/></span><div><strong>Get started</strong><span>Record your first activity</span></div><span className="milestone-status done">{entries.length ? "Started" : "Next"}</span></div><div className="milestone-row"><span className={`milestone-check ${verified >= 80 ? "" : "muted"}`}><CheckCircle2 size={15}/></span><div><strong>Build consistency</strong><span>Reach 80 verified hours</span></div><span className={`milestone-status ${verified >= 80 ? "done" : ""}`}>{verified >= 80 ? "Reached" : `${Math.min(100, Math.round(verified / 80 * 100))}%`}</span></div><div className="milestone-row"><span className={`milestone-check ${verified >= REQUIRED_HOURS ? "" : "muted"}`}><GraduationCap size={15}/></span><div><strong>Complete placement</strong><span>Reach your required hours</span></div><span className={`milestone-status ${verified >= REQUIRED_HOURS ? "done" : ""}`}>{verified >= REQUIRED_HOURS ? "Complete" : "In progress"}</span></div></div></article>
    </section>

    <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent logbook activity</h2><p>Latest updates from your internship journal</p></div><Button variant="outline" size="sm" asChild><Link to="/logbook">View logbook <ArrowRight size={14}/></Link></Button></div>{entries.length ? <div className="activity-table-wrap"><table className="activity-table"><thead><tr><th>ACTIVITY</th><th>DATE</th><th>HOURS</th><th>STATUS</th><th/></tr></thead><tbody>{entries.slice(0, 5).map((entry) => <tr key={entry.id}><td><div className="activity-title"><span className="activity-file-icon"><FileText size={16}/></span><div><strong>{entry.tasks.length > 66 ? `${entry.tasks.slice(0, 66)}…` : entry.tasks || "Untitled entry"}</strong><span>{entry.skills || `Week ${entry.week} activity`}</span></div></div></td><td className="activity-date">{new Intl.DateTimeFormat("en-UG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${entry.date}T12:00:00`))}</td><td className="activity-hours">{entry.hours}h</td><td><StatusBadge status={entry.status}/></td><td><Link to="/logbook" className="activity-open" aria-label="Open logbook"><ArrowUpRight size={16}/></Link></td></tr>)}</tbody></table></div> : <div className="empty-activity"><FileText size={28}/><strong>No entries yet</strong><span>Your logbook activity will appear here.</span><Button asChild size="sm"><Link to="/logbook">Create first entry</Link></Button></div>}<div className="activity-footer"><span>Showing {Math.min(5, entries.length)} of {entries.length} entries</span><Link to="/logbook">See all activity <ArrowRight size={14}/></Link></div></section>

    <section className="bottom-prompt"><div className="prompt-icon"><Sparkles size={20}/></div><div><strong>Need a hand with your logbook?</strong><p>InternAI can help you turn your notes into clear, professional entries.</p></div><Button variant="outline" asChild><Link to="/assistant">Try InternAI <ArrowDownRight size={15}/></Link></Button></section>
    {role === "student" && applications.length > 0 && <p className="dashboard-footnote">You&apos;re also tracking {applications.length} internship {applications.length === 1 ? "application" : "applications"}. <Link to="/vacancies">View applications <ArrowRight size={13}/></Link></p>}
    <div className="dashboard-role-note"><span><GraduationCap size={15}/></span> Viewing as <strong>{ROLE_LABELS[role]}</strong> · Your workspace adapts to your role.</div>
  </div>;
}
