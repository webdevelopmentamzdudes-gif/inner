"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-secondary"
      title="Print or save the page as PDF"
    >
      <Printer className="size-4" /> Print
    </button>
  );
}
