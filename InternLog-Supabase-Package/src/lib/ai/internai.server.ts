import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

export type InternAIMode = "polish" | "report" | "guidelines";

const SAFEGUARD =
  "Never invent tasks, results, or achievements. Only use what the student actually recorded. If information is missing, say so instead of fabricating it.";

const INTEGRITY =
  "AI assists with grammar and report organization only; all reported tasks must reflect genuine student work.";

// Institution-specific rules (hours, report chapters, grading weights) can be supplied with the
// INTERNAI_RULES environment variable. Without it, InternAI gives general good-practice guidance.
const DEFAULT_RULES = `General internship good practice (rules differ between institutions):
- Keep a dated logbook entry for each working day: tasks, skills used, hours worked.
- The workplace supervisor reviews and signs entries, usually weekly; an academic supervisor monitors progress.
- Typical final report: introduction and background of the host organisation; activities and skills acquired; lessons learned, challenges and solutions; conclusions and recommendations.
- Required hours, duration and assessment weights vary. If asked about them, tell the student to confirm with their institution's internship coordinator.`;

const rules = () => process.env["INTERNAI_RULES"]?.trim() || DEFAULT_RULES;

const PROMPTS: Record<InternAIMode, () => string> = {
  polish: () =>
    `You are InternAI, a writing assistant for internship logbooks used by university and tertiary students. Rewrite the student's rough notes into a concise, formal, first-person technical logbook summary (3-6 sentences). Keep every fact; fix grammar and tone. Return only the rewritten text. ${SAFEGUARD}`,
  report: () =>
    `You are InternAI, helping a student draft their internship report from verified logbook entries. Follow the report structure in these rules if one is given, otherwise use: ## Introduction and Background of the Organisation, ## Activities and Practical Skills Acquired, ## Lessons Learned, Challenges and Solutions, ## Conclusions and Recommendations. Base everything strictly on the entries provided.\n${rules()}\n${SAFEGUARD}`,
  guidelines: () =>
    `You are InternAI, a guidelines assistant for internship students, workplace supervisors and academic staff. Answer questions about logbook keeping, report structure, supervision, assessment and professional conduct using only these rules.\n${rules()}\nRemind students when relevant: ${INTEGRITY} Be concise and use markdown.`,
};

function offlineResponse(mode: InternAIMode, text: string) {
  if (mode === "report") {
    const entries = text.split("\\n").filter(Boolean);
    return [
      "## Internship Report Draft",
      "",
      "### Activities and Practical Skills Acquired",
      "The following draft is based only on the verified logbook entries provided:",
      ...entries.map((entry) => `- ${entry}`),
      "",
      "### Lessons Learned, Challenges and Solutions",
      "Add the specific lessons, challenges and solutions that you personally experienced.",
      "",
      "### Conclusions and Recommendations",
      "Add your own conclusion and recommendations after reviewing this draft.",
    ].join("\\n");
  }

  if (mode === "guidelines") {
    return "Keep dated entries with clear tasks, skills used and hours worked. Ask your workplace supervisor to review entries regularly, then confirm your institution's required report structure and total hours with the internship coordinator.";
  }

  return text.trim();
}

export async function runInternAI(mode: InternAIMode, text: string) {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return offlineResponse(mode, text);

  const provider = createOpenAI({ apiKey });
  const modelId = process.env["INTERNAI_MODEL"] ?? "gpt-4o-mini";

  try {
    const result = await generateText({
      // Cast: ai and @ai-sdk/openai pin slightly different @ai-sdk/provider patch versions (type-only mismatch).
      model: provider(modelId) as unknown as Parameters<typeof generateText>[0]["model"],
      system: PROMPTS[mode](),
      messages: [{ role: "user", content: text }],
    });
    const out = result.text.trim();
    if (!out) throw new Error("empty");
    return out;
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode;
    if (status === 429) throw new Error("InternAI is busy or out of credit. Please try again shortly.");
    if (status === 401) throw new Error("AI key is invalid. Contact the administrator.");
    throw new Error("InternAI could not produce a response. Please try again.");
  }
}
