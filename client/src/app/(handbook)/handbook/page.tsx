import type { JSX } from "react";
import type { Metadata } from "next";
import { HandbookHome } from "@/components/handbook/handbook-home";

export const metadata: Metadata = {
  title: "Eduto Handbook",
  description:
    "Strategické principy, produktová doktrína a aktuální pořadí práce na projektu Eduto.",
  robots: { index: false, follow: false },
};

export default function HandbookHomePage(): JSX.Element {
  return <HandbookHome />;
}
