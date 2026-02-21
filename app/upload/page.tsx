"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const UploadForm = dynamic(
  () => import("@/components/upload-form").then((m) => m.UploadForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center gap-2 py-24">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
        <span className="text-sm text-zinc-400">Loading...</span>
      </div>
    ),
  }
);

export default function UploadPage() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Back
      </Link>

      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          New Episode
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Provide a direct link to a podcast audio file to transcribe.
        </p>
      </header>

      <UploadForm />
    </div>
  );
}
