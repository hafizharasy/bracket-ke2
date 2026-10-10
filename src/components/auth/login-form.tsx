"use client";

import { EyeIcon, EyeOffIcon, Loader2Icon, LogInIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { LoginResult } from "@/app/masuk/actions";
import { cn } from "@/lib/utils";

/**
 * Form login ramah ponsel: input besar, tampil/sembunyi sandi, validasi
 * ringan di klien, pesan galat dari server. `submit` = aksi login.
 */
export function LoginForm({
  submit,
  next,
  emailLabel = "Email",
}: {
  submit: (email: string, password: string, next?: string) => Promise<LoginResult>;
  /** Halaman tujuan setelah login (divalidasi di server). */
  next?: string;
  emailLabel?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Isi email dan sandi.");
    setBusy(true);
    setError(null);
    try {
      const result = await submit(email, password, next);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      router.replace(result.redirectTo);
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.");
      setBusy(false);
    }
  }

  const input = "h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{emailLabel}</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
          placeholder="nama@contoh.id"
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Sandi</span>
        <span className="relative">
          <input
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error}
            className={cn(input, "pr-12")}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={show ? "Sembunyikan sandi" : "Tampilkan sandi"}
          >
            {show ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
          </button>
        </span>
      </label>
      <div aria-live="assertive" className="min-h-5 text-sm text-destructive">
        {error}
      </div>
      <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
        {busy ? <Loader2Icon className="animate-spin" /> : <LogInIcon />}
        Masuk
      </Button>
    </form>
  );
}
