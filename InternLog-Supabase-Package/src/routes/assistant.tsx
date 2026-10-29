import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Loader2, MessageCircleQuestion, ShieldAlert, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { askInternAI } from "@/lib/ai/internai.functions";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "InternAI Assistant — InternLog" },
      { name: "description", content: "Draft your internship report from verified logbook entries and ask questions about internship guidelines." },
      { property: "og:title", content: "InternAI — Internship report and guidelines assistant" },
      { property: "og:description", content: "AI drafting help grounded in your verified logbook entries." },
    ],
  }),
  component: Assistant,
});

function Assistant() {
  const { entries } = useApp();
  const ask = useServerFn(askInternAI);
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const verified = entries.filter((e) => e.status === "approved" || e.status === "feedback");

  const draft = async () => {
    if (!verified.length) { toast.error("You need approved entries before drafting a report."); return; }
    setBusy(true);
    const text = verified.map((e) => `${e.date} (week ${e.week}, ${e.hours}h): ${e.tasks} | Skills: ${e.skills}`).join("\n");
    const res = await ask({ data: { mode: "report", text } });
    setBusy(false);
    if (res.ok) setReport(res.text); else toast.error(res.error);
  };

  const send = async () => {
    if (q.trim().length < 3) return;
    const history = [...chat, { role: "user" as const, text: q }];
    setChat(history); setQ(""); setBusy(true);
    const res = await ask({ data: { mode: "guidelines", text: history.map((m) => `${m.role === "user" ? "Student" : "InternAI"}: ${m.text}`).join("\n") } });
    setBusy(false);
    if (res.ok) setChat([...history, { role: "ai", text: res.text }]); else toast.error(res.error);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">InternAI</h1>
        <p className="text-sm text-muted-foreground">Your writing and guidelines assistant.</p>
      </div>
      <p className="flex gap-2 rounded-lg bg-warning-soft p-3 text-sm"><ShieldAlert className="size-4 shrink-0 text-warning" />Drafts use only your supervisor-verified entries. Review and rewrite in your own words before submitting.</p>
      <Tabs defaultValue="report">
        <TabsList><TabsTrigger value="report"><FileText /> Report drafter</TabsTrigger><TabsTrigger value="chat"><MessageCircleQuestion /> Guidelines</TabsTrigger></TabsList>
        <TabsContent value="report" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5 shadow-card">
            <p className="text-sm">{verified.length} verified {verified.length === 1 ? "entry" : "entries"} available.</p>
            <Button onClick={draft} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <FileText />} Draft report</Button>
          </div>
          {report && <pre className="whitespace-pre-wrap rounded-xl border bg-card p-5 font-sans text-sm leading-relaxed shadow-card">{report}</pre>}
        </TabsContent>
        <TabsContent value="chat" className="mt-4">
          <div className="flex h-[60vh] flex-col rounded-xl border bg-card shadow-card">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {chat.length === 0 && <p className="text-sm text-muted-foreground">Ask about logbook rules, report structure or supervision.</p>}
              {chat.map((m, i) => (
                <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground" : "max-w-[90%] whitespace-pre-wrap text-sm leading-relaxed"}>{m.text}</div>
              ))}
              {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </div>
            <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="How should I structure my final report?" />
              <Button type="submit" size="icon" disabled={busy} aria-label="Send"><Send /></Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
