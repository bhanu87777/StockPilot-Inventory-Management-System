"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-accent rounded-lg px-5 py-2.5 text-sm">
      ⎙ Print / Save as PDF
    </button>
  );
}
