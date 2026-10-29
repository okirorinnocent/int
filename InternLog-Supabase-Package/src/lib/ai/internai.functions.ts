import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const askInternAI = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      mode: z.enum(["polish", "report", "guidelines"]),
      text: z.string().min(3).max(20000),
    }),
  )
  .handler(async ({ data }) => {
    const { runInternAI } = await import("./internai.server");
    try {
      return { ok: true as const, text: await runInternAI(data.mode, data.text) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Something went wrong." };
    }
  });
