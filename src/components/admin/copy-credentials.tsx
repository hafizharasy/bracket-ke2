"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Kotak kredensial login + tombol salin, untuk diberikan ke pengawas. */
export function CopyCredentials({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Login pengawas Bracket LRP 2026\nEmail: ${email}\nSandi: ${password}`;
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2 font-mono text-xs">
      <span className="min-w-0 flex-1 truncate">
        {email} · {password}
      </span>
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Tersalin" : "Salin"}
      </Button>
    </div>
  );
}
