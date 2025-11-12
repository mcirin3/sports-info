// src/lib/env.ts
import { z } from "zod";

const EnvSchema = z.object({
  APISPORTS_KEY: z.string().min(1, "Missing APISPORTS_KEY"),
  APISPORTS_HOST: z.string().min(1, "Missing APISPORTS_HOST"),
});

export const env = (() => {
  const parsed = EnvSchema.safeParse({
    APISPORTS_KEY: process.env.APISPORTS_KEY || "",
    APISPORTS_HOST: process.env.APISPORTS_HOST || "",
  });
  if (!parsed.success) {
    // Throw a readable error at server start
    const { fieldErrors } = parsed.error.flatten();
    const msg = Object.values(fieldErrors).flat().join(", ");
    throw new Error(`Environment validation failed: ${msg}`);
  }
  return parsed.data;
})();
