import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { isAdminAuthenticated } from "~/lib/auth";

export const createTRPCContext = async () => {
  const isAdmin = await isAdminAuthenticated();
  return {
    isAdmin,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedAdminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.isAdmin) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin login required" });
  }
  return next({
    ctx: {
      ...ctx,
      isAdmin: true,
    },
  });
});
