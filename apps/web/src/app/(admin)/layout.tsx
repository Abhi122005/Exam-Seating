"use client";

import { TRPCProvider } from "~/trpc/Provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <TRPCProvider>{children}</TRPCProvider>;
}
