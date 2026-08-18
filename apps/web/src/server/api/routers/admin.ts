import { z } from "zod";
import { createTRPCRouter, protectedAdminProcedure, publicProcedure } from "../trpc";
import { checkAdminPassword, getAdminCookieHeader, getClearAdminCookieHeader } from "~/lib/auth";
import { deleteExamData, readManifest, writeExamData, writeManifest } from "~/lib/blob";

export const adminRouter = createTRPCRouter({
  login: publicProcedure.input(z.object({ password: z.string() })).mutation(({ input }) => {
    const valid = checkAdminPassword(input.password);
    if (!valid) {
      return { success: false, message: "Invalid admin password" };
    }
    return {
      success: true,
      cookie: getAdminCookieHeader(input.password),
    };
  }),

  logout: publicProcedure.mutation(() => {
    return {
      success: true,
      cookie: getClearAdminCookieHeader(),
    };
  }),

  deleteExam: protectedAdminProcedure
    .input(z.object({ examId: z.string() }))
    .mutation(async ({ input }) => {
      await deleteExamData(input.examId);
      const manifest = await readManifest();
      const nextManifest = manifest.filter((e) => e.examId !== input.examId);
      await writeManifest(nextManifest);
      return { success: true };
    }),

  updateSchedule: protectedAdminProcedure
    .input(
      z.object({
        examId: z.string(),
        publishAt: z.string(),
        expiresAt: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const manifest = await readManifest();
      const idx = manifest.findIndex((e) => e.examId === input.examId);
      if (idx === -1) {
        return { success: false, message: "Exam not found" };
      }
      manifest[idx]!.publishAt = input.publishAt;
      manifest[idx]!.expiresAt = input.expiresAt;
      await writeManifest(manifest);
      return { success: true };
    }),
});
