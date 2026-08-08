"use client";

import { redirect, useParams } from "next/navigation";

export default function LegacyTestDetailPage(): never {
  const { testId } = useParams<{ testId: string }>();
  redirect(`/app/tests/${encodeURIComponent(testId)}`);
}
