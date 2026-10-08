import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Request Account Deletion | Masanawa",
  description: "Request deletion of your Masanawa account with secure identity verification, even without the Android app.",
  robots: { index: true, follow: true },
};

export default function DeletionLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
