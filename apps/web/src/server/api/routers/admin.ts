import { z } from "zod";
import { createTRPCRouter, protectedAdminProcedure } from "../trpc";
import { deleteExamData, readManifest, writeManifest } from "~/lib/blob";

export const adminRouter = createTRPCRouter({
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
