import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Sparkles as Wand, HardDrive, Send, Check, MessageSquareWarning, Trash2, ShieldAlert, Loader2, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/AppShell";
import { useApp, type LogEntry, type LogStatus } from "@/lib/store";
import { askInternAI } from "@/lib/ai/internai.functions";

export const Route = createFileRoute("/logbook")({
  head: () => ({
    meta: [
      { title: "Digital Logbook — InternLog" },
      { name: "description", content: "Record daily internship activities, polish them with InternAI and submit for supervisor sign-off." },
      { property: "og:title", content: "Digital Logbook — InternLog" },
      { property: "og:description", content: "Daily internship logbook with AI writing help and supervisor approvals." },
    ],
  }),
  component: Logbook,
});

const blank = (): LogEntry => ({
  id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), week: 1, tasks: "", skills: "", hours: 8, status: "draft", updatedAt: Date.now(),
});

function cleanPlainText(value: string, maxLength: number) {
  // Store plain text only. React escapes text nodes on render; never inject this with dangerouslySetInnerHTML.
  return value.normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, maxLength);
}

function localDateISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function Logbook() {
  const { role, entries, upsert, remove } = useApp();
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const ask = useServerFn(askInternAI);
  const isStudent = role === "student";
  const list = isStudent ? entries : entries.filter((e) => e.status !== "draft");

  const save = (status: LogStatus) => {
    if (!editing) return;
    const today = new Date();
    const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (!isValidDateOnly(editing.date) || editing.date > todayLocal) { toast.error("Choose a valid date that is today or earlier."); return; }
    if (!Number.isFinite(editing.hours) || editing.hours <= 0 || editing.hours > 16) { toast.error("Hours must be greater than 0 and no more than 16 for one calendar date."); return; }
    if (!Number.isInteger(editing.week) || editing.week < 1 || editing.week > 60) { toast.error("Week must be a whole number from 1 to 60."); return; }
    const tasks = cleanPlainText(editing.tasks.trim(), 4000);
    const skills = cleanPlainText(editing.skills.trim(), 500);
    if (tasks.length < 1) { toast.error("Describe the tasks you performed first."); return; }
    if (tasks.length > 4000 || skills.length > 500) { toast.error("One or more fields exceed the allowed length."); return; }
    upsert({ ...editing, tasks, skills, status, updatedAt: Date.now() });
    toast.success(status === "submitted" ? "Submitted to your supervisor" : "Saved on this device", {
      description: navigator.onLine ? undefined : "You're offline — it stays safe here.",
    });
    setEditing(null);
  };

  const polish = async () => {
    if (!editing || editing.tasks.trim().length < 10) { toast.error("Write a few rough notes first."); return; }
    setPolishing(true);
    const res = await ask({ data: { mode: "polish", text: `Tasks: ${editing.tasks}\nSkills: ${editing.skills}` } });
    setPolishing(false);
    if (res.ok) {
      setEditing({ ...editing, tasks: res.text });
      toast.success("InternAI polished your entry — check it still matches what you did.");
    } else toast.error(res.error);
  };

  const review = (e: LogEntry, status: LogStatus) => {
    if (role === "student" || e.status !== "submitted") { toast.error("Only an assigned supervisor can review a submitted entry."); return; }
    const feedback = cleanPlainText(comments[e.id] || e.feedback || "", 2000);
    upsert({ ...e, status, feedback, updatedAt: Date.now() });
    toast.success(status === "approved" ? "Entry approved and signed off" : status === "changes" ? "Changes requested" : "Feedback sent");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{isStudent ? "Digital Logbook" : "Logbook reviews"}</h1>
          <p className="text-sm text-muted-foreground">{isStudent ? "Entries are saved on this device as you work." : "Approve, comment on or return submitted entries."}</p>
        </div>
        {isStudent && <Button size="lg" onClick={() => setEditing(blank())}><Plus /> New entry</Button>}
      </div>

      {list.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed p-12 text-center">
          <NotebookPen className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No entries yet</p>
          <p className="text-sm text-muted-foreground">Your daily activities will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((e) => (
            <article key={e.id} className="rounded-xl border bg-card p-4 shadow-card md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{e.date}</span>
                  <span className="text-muted-foreground">· Week {e.week} · {e.hours}h</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><HardDrive className="size-3" /> Saved locally</span>
                  <StatusBadge status={e.status} />
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed">{e.tasks}</p>
              {e.skills && <p className="mt-2 text-xs text-muted-foreground">Skills: {e.skills}</p>}
              {e.feedback && <p className="mt-3 rounded-lg bg-muted p-3 text-sm"><span className="font-medium">Supervisor: </span>{e.feedback}</p>}

              {isStudent && (e.status === "draft" || e.status === "changes") && (
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(e)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(e.id)} aria-label="Delete"><Trash2 /></Button>
                </div>
              )}
              {!isStudent && role !== "admin" && e.status === "submitted" && (
                <div className="mt-4 space-y-2">
                  <Textarea placeholder="Inline comment (optional)" value={comments[e.id] ?? ""} maxLength={2000} onChange={(ev) => setComments({ ...comments, [e.id]: cleanPlainText(ev.target.value, 2000) })} rows={2} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => review(e, "approved")}><Check /> Approve & sign</Button>
                    <Button size="sm" variant="outline" onClick={() => review(e, "changes")}><MessageSquareWarning /> Request changes</Button>
                    <Button size="sm" variant="ghost" onClick={() => review(e, "feedback")}>Send feedback</Button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Logbook entry</SheetTitle>
            <SheetDescription>Record what you actually did today.</SheetDescription>
          </SheetHeader>
          {editing && (
            <div className="space-y-4 px-4 pb-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 space-y-1.5 sm:col-span-1"><Label>Date</Label><Input type="date" max={localDateISO()} value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} required /></div>
                <div className="space-y-1.5"><Label>Week</Label><Input type="number" min={1} max={60} step={1} value={editing.week} onChange={(e) => setEditing({ ...editing, week: Number(e.target.value) })} required /></div>
                <div className="space-y-1.5"><Label>Hours</Label><Input type="number" min={0.1} max={16} step={0.1} value={editing.hours} onChange={(e) => setEditing({ ...editing, hours: Number(e.target.value) })} required aria-describedby="hours-hint" /><span id="hours-hint" className="text-xs text-muted-foreground">0.1–16 hours per calendar date.</span></div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Tasks performed</Label>
                  <Button type="button" variant="outline" size="sm" onClick={polish} disabled={polishing}>
                    {polishing ? <Loader2 className="animate-spin" /> : <Wand />} Polish with InternAI
                  </Button>
                </div>
                <Textarea rows={7} value={editing.tasks} placeholder="e.g. helped set up switches in finance office, tested ping..." maxLength={4000} onChange={(e) => setEditing({ ...editing, tasks: cleanPlainText(e.target.value, 4000) })} />
              </div>
              <div className="space-y-1.5"><Label>Skills applied</Label><Input value={editing.skills} maxLength={500} onChange={(e) => setEditing({ ...editing, skills: cleanPlainText(e.target.value, 500) })} placeholder="React, networking, report writing" /></div>
              <p className="flex gap-2 rounded-lg bg-warning-soft p-3 text-xs"><ShieldAlert className="size-4 shrink-0 text-warning" />InternAI only rewords what you write. Only record genuine tasks — fabricated entries are academic misconduct.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => save("draft")}><HardDrive /> Save draft</Button>
                <Button className="flex-1" onClick={() => save("submitted")}><Send /> Submit</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
