"use client";

import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/api/client";
import {
  useForgotPassword,
  useLogin,
  useRegister,
} from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export type AuthView = "login" | "register" | "forgot";

const inputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-violet-500/60";

const submitButtonClass =
  "flex h-11 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white transition-colors hover:bg-violet-500 disabled:pointer-events-none disabled:opacity-60";

export function AuthDialog({
  open,
  onOpenChange,
  defaultView = "login",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultView?: AuthView;
}) {
  const [view, setView] = useState<AuthView>(defaultView);

  useEffect(() => {
    if (open) setView(defaultView);
  }, [open, defaultView]);

  function handleSuccess() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 border-0 bg-transparent p-0 text-white shadow-none ring-0 sm:max-w-md">
        <DialogTitle className="sr-only">
          {view === "login" ? "Log in" : view === "register" ? "Create your account" : "Reset your password"}
        </DialogTitle>
        {view === "login" ? (
          <LoginForm
            onSwitchToRegister={() => setView("register")}
            onSwitchToForgot={() => setView("forgot")}
            onSuccess={handleSuccess}
          />
        ) : view === "register" ? (
          <RegisterForm onSwitchToLogin={() => setView("login")} onSuccess={handleSuccess} />
        ) : (
          <ForgotPasswordForm onBackToLogin={() => setView("login")} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-violet-600 text-lg font-bold text-white">
        A
      </span>
      <div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  minLength,
  invalid,
  action,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minLength?: number;
  invalid?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm text-zinc-400">{label}</label>
        {action}
      </div>
      <input
        type={type}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, invalid && "border-red-500/60 focus:border-red-500")}
      />
    </div>
  );
}

function LoginForm({
  onSwitchToRegister,
  onSwitchToForgot,
  onSuccess,
}: {
  onSwitchToRegister: () => void;
  onSwitchToForgot: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { mutate, isPending, isError, error, reset } = useLogin();
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutate(
      { email, password },
      {
        onSuccess: () => {
          onSuccess();
          router.push("/dashboard");
        },
      },
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-zinc-950 p-8",
        isError ? "border-red-500/60" : "border-white/10",
      )}
    >
      <AuthHeader title="Welcome back" subtitle="Sign in to your account" />
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            if (isError) reset();
          }}
          placeholder="you@company.com"
          invalid={isError}
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            if (isError) reset();
          }}
          placeholder="••••••••"
          invalid={isError}
          action={
            <button
              type="button"
              onClick={onSwitchToForgot}
              className="text-sm font-medium text-violet-400 hover:underline"
            >
              Forgot?
            </button>
          }
        />
        {isError ? <p className="-mt-2 text-sm text-red-400">{getErrorMessage(error)}</p> : null}
        <button type="submit" disabled={isPending} className={submitButtonClass}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-400">
        Don&rsquo;t have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-semibold text-violet-400 hover:underline"
        >
          Sign up
        </button>
      </p>
    </div>
  );
}

function RegisterForm({
  onSwitchToLogin,
  onSuccess,
}: {
  onSwitchToLogin: () => void;
  onSuccess: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const { mutate, isPending, isError, error } = useRegister();
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutate(
      { fullName, email, password },
      {
        onSuccess: () => {
          onSuccess();
          router.push("/dashboard");
        },
      },
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
      <AuthHeader
        title="Create your account"
        subtitle="Start reading documents with AI in minutes"
      />
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Jane Doe" />
        <Field
          label="Work email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Min. 8 characters"
          minLength={8}
        />
        {isError ? <p className="text-sm text-red-400">{getErrorMessage(error)}</p> : null}
        <label className="flex items-start gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-white/20 bg-white/5 accent-violet-600"
          />
          I agree to the Terms &amp; Privacy Policy
        </label>
        <button type="submit" disabled={isPending || !agreed} className={submitButtonClass}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-400">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold text-violet-400 hover:underline"
        >
          Log in
        </button>
      </p>
    </div>
  );
}

function ForgotPasswordForm({ onBackToLogin }: { onBackToLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { mutate, isPending, isError, error } = useForgotPassword();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutate(email, { onSuccess: () => setSent(true) });
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <Check className="size-5" />
        </span>
        <h2 className="mt-4 text-xl font-bold text-white">Check your email</h2>
        <p className="mt-1 text-sm text-zinc-400">
          We&rsquo;ve sent a password reset link to {email}.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          Didn&rsquo;t get it?{" "}
          <button
            type="button"
            onClick={() => mutate(email)}
            className="font-semibold text-violet-400 hover:underline"
          >
            Resend
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
      <AuthHeader title="Reset your password" subtitle="We'll email you a link to reset it" />
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
        />
        {isError ? <p className="text-sm text-red-400">{getErrorMessage(error)}</p> : null}
        <button type="submit" disabled={isPending} className={submitButtonClass}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : "Send reset link"}
        </button>
      </form>
      <button
        type="button"
        onClick={onBackToLogin}
        className="mt-6 flex w-full items-center justify-center gap-1.5 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="size-3.5" />
        Back to log in
      </button>
    </div>
  );
}
