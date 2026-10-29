import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Search, MapPin, BriefcaseBusiness, Clock3, SlidersHorizontal, Plus, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/vacancies")({ head: () => ({ meta: [{ title: "Vacancies — InternLog" }] }), component: Vacancies });

type Vacancy = { id: string; title: string; company: string; location: string; field: string; duration: string; paid: boolean; deadline: string; description: string; skills: string[] };
const SEED: Vacancy[] = [
  { id: "v1", title: "Frontend Engineering Intern", company: "Mara Digital", location: "Kampala · Hybrid", field: "Technology", duration: "12 weeks", paid: true, deadline: "Nov 18, 2026", description: "Build accessible interfaces with a small product team shipping tools for East African businesses.", skills: ["React", "TypeScript", "Figma"] },
  { id: "v2", title: "Network Support Intern", company: "Uganda Telecom", location: "Kampala · On-site", field: "ICT", duration: "16 weeks", paid: true, deadline: "Nov 24, 2026", description: "Support the infrastructure team with network monitoring, documentation and field visits.", skills: ["Networking", "Linux", "Cisco"] },
  { id: "v3", title: "Community Research Intern", company: "Civic Labs", location: "Remote", field: "Research", duration: "8 weeks", paid: false, deadline: "Dec 02, 2026", description: "Help turn field research into clear, useful stories and community-facing resources.", skills: ["Research", "Writing", "Data"] },
];

function Vacancies() {
  const { role } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<Vacancy | null>(null);
  const [applied, setApplied] = useState<string[]>(["v2"]);
  const isEmployer = role === "workplace";
  const filtered = SEED.filter((v) => `${v.title} ${v.company} ${v.field}`.toLowerCase().includes(query.toLowerCase())).filter((v) => filter === "All" || (filter === "Paid" ? v.paid : v.location.includes(filter)));
  const apply = (id: string) => { setApplied((items) => [...items, id]); setSelected(null); toast.success("Application submitted", { description: "The employer will review your profile and CV." }); };

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-accent">Opportunity hub</p><h1 className="text-2xl font-semibold md:text-3xl">Internship vacancies</h1><p className="mt-1 text-sm text-muted-foreground">Find a placement that fits your skills and goals.</p></div>{isEmployer && <Button onClick={() => toast.success("Vacancy draft created") }><Plus data-icon="inline-start" /> Post a vacancy</Button>}</div>
    <Tabs defaultValue="explore"><TabsList><TabsTrigger value="explore">Explore vacancies</TabsTrigger><TabsTrigger value="applications">My applications <Badge variant="secondary" className="ml-2">{applied.length}</Badge></TabsTrigger>{isEmployer && <TabsTrigger value="manage">Manage listings</TabsTrigger>}</TabsList>
      <TabsContent value="explore" className="flex flex-col gap-4">
        <Card><CardContent className="flex flex-col gap-3 p-4 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search roles, companies or skills" value={query} onChange={(e) => setQuery(e.target.value)} /></div><div className="flex gap-2"><Button variant={filter === "All" ? "secondary" : "outline"} onClick={() => setFilter("All")}><SlidersHorizontal data-icon="inline-start" /> All</Button>{["Paid", "Remote"].map((item) => <Button key={item} variant={filter === item ? "secondary" : "outline"} onClick={() => setFilter(item)}>{item}</Button>)}</div></CardContent></Card>
        <div className="grid gap-4 lg:grid-cols-2">{filtered.map((v) => <Card key={v.id} className="transition-shadow hover:shadow-card"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{v.title}</CardTitle><CardDescription className="mt-1 flex items-center gap-1"><BriefcaseBusiness className="size-3.5" />{v.company}</CardDescription></div><Badge variant={v.paid ? "default" : "outline"}>{v.paid ? "Paid" : "Unpaid"}</Badge></div></CardHeader><CardContent><p className="text-sm leading-relaxed text-muted-foreground">{v.description}</p><div className="mt-4 flex flex-wrap gap-2">{v.skills.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}</div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MapPin className="size-3.5" />{v.location}</span><span className="flex items-center gap-1"><Clock3 className="size-3.5" />{v.duration}</span><Button size="sm" onClick={() => setSelected(v)}>View details <ArrowUpRight data-icon="inline-end" /></Button></div></CardContent></Card>)}</div>
      </TabsContent>
      <TabsContent value="applications"><Card><CardHeader><CardTitle>Application tracking</CardTitle><CardDescription>Keep an eye on every opportunity you have submitted.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">{SEED.filter((v) => applied.includes(v.id)).map((v, i) => <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><p className="font-medium">{v.title}</p><p className="text-sm text-muted-foreground">{v.company}</p></div><Badge variant={i === 0 ? "secondary" : "default"}>{i === 0 ? "Under review" : "Submitted"}</Badge></div>)}</CardContent></Card></TabsContent>
      {isEmployer && <TabsContent value="manage"><Card><CardHeader><CardTitle>Your listings</CardTitle><CardDescription>Publish, edit and close internship opportunities.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">{SEED.slice(0, 2).map((v) => <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><p className="font-medium">{v.title}</p><p className="text-sm text-muted-foreground">{v.company} · 24 applicants</p></div><div className="flex items-center gap-2"><Badge>Published</Badge><Button variant="outline" size="sm" onClick={() => toast.success("Listing updated")}>Edit</Button></div></div>)}</CardContent></Card></TabsContent>}
    </Tabs>
    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>{selected?.company} · {selected?.location}</DialogDescription></DialogHeader>{selected && <div className="flex flex-col gap-4"><p className="text-sm leading-relaxed">{selected.description}</p><div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Duration</p><p className="font-medium">{selected.duration}</p></div><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Deadline</p><p className="font-medium">{selected.deadline}</p></div></div><div><Label htmlFor="cover-note">Optional cover note</Label><Textarea id="cover-note" className="mt-2" placeholder="Tell the employer why you're a good fit..." /></div><Button onClick={() => apply(selected.id)} disabled={applied.includes(selected.id)}>{applied.includes(selected.id) ? <><CheckCircle2 data-icon="inline-start" /> Applied</> : "Submit application"}</Button></div>}</DialogContent></Dialog>
  </div>;
}
