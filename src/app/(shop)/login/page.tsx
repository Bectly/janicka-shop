import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Přihlášení — Janička",
  description: "Přihlášení do zákaznického účtu.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10">
      <Link
        href="/"
        className="mb-8 font-heading text-3xl font-bold tracking-tight text-foreground"
      >
        Janička
      </Link>
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
