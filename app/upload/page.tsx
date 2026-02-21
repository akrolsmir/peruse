"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const UploadForm = dynamic(
  () => import("@/components/upload-form").then((m) => m.UploadForm),
  { ssr: false }
);

export default function UploadPage() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        &larr; Back
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        New Episode
      </h1>

      <UploadForm />
    </div>
  );
}
