import { createTRPCRouter, publicProcedure } from "../trpc";
import { readManifest } from "~/lib/blob";

export const seatingRouter = createTRPCRouter({
  getManifest: publicProcedure.query(async () => {
    return await readManifest();
  }),
});