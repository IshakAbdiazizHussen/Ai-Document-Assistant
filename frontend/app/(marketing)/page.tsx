"use client";

import { ArrowRight, FileText, MessageSquare, Search, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AuthDialog } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-auth";
import { marketingNavLinks } from "@/lib/marketing-nav";

const documents = [
  { name: "Q3_Board_Deck.pdf", active: true },
  { name: "Vendor_Contract.docx", active: false },
  { name: "Research_Notes.txt", active: false },
];

const features = [
  {
    icon: Upload,
    title: "Upload documents",
    description:
      "Drop in PDFs, Word docs and text files. We extract and index every page in seconds.",
  },
  {
    icon: MessageSquare,
    title: "AI conversations",
    description:
      "Ask questions in plain language and get grounded answers, with follow-ups that keep context.",
  },
  {
    icon: Search,
    title: "Smart search",
    description:
      "Find the right passage across your whole library, ranked by meaning, not just keywords.",
  },
  {
    icon: FileText,
    title: "Source citations",
    description:
      "Every answer links back to the exact page and passage it came from — no guessing, no hallucinating.",
  },
];

const workflowSteps = [
  { number: "1", title: "Upload", description: "Add files from your device or cloud storage" },
  { number: "2", title: "Process", description: "Sift reads, chunks and indexes the content" },
  { number: "3", title: "Ask AI", description: "Ask anything, in your own words" },
  { number: "4", title: "Get answers", description: "Grounded answers with exact citations" },
];

export default function Home() {
  const { data: user } = useCurrentUser();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="relative isolate flex flex-1 flex-col overflow-hidden bg-white dark:bg-[#0a0a0c]">
      <div
        className="pointer-events-none absolute inset-x-0 -z-10"
        style={{ top: "798px", height: "300px" }}
      >
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 overflow-hidden rounded-full dark:hidden"
          style={{
            width: "min(1600px, 120vw)",
            height: "620px",
            filter: "blur(55px)",
            background:
              "radial-gradient(ellipse at 50% 58%, rgba(139,92,246,0.32) 0%, rgba(139,92,246,0.24) 30%, rgba(124,58,237,0.16) 55%, rgba(109,40,217,0.09) 78%, rgba(109,40,217,0.03) 100%)",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              opacity: 0.12,
              mixBlendMode: "overlay",
            }}
          />
        </div>
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 hidden overflow-hidden rounded-full dark:block"
          style={{
            width: "min(1600px, 120vw)",
            height: "620px",
            filter: "blur(55px)",
            background:
              "radial-gradient(ellipse at 50% 58%, rgba(109,40,217,0.5) 0%, rgba(109,40,217,0.38) 30%, rgba(91,33,182,0.28) 55%, rgba(76,29,149,0.18) 78%, rgba(76,29,149,0.08) 100%)",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              opacity: 0.12,
              mixBlendMode: "overlay",
            }}
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-24 pb-16 text-center sm:pt-32">
        <h1 className="text-5xl leading-[0.95] font-black tracking-tight text-zinc-900 sm:text-6xl md:text-7xl dark:text-white">
          Every answer,
          <br />
          traced to the source.
        </h1>

        <p className="mt-8 max-w-2xl text-lg text-zinc-600 sm:text-xl dark:text-zinc-400">
          Upload contracts, reports and research. Ask questions in plain
          language. Get grounded answers with exact citations back to the
          page they came from.
        </p>

        <div className="mt-10 flex items-center gap-3">
          {user ? (
            <Button
              render={<Link href="/dashboard" />}
              nativeButton={false}
              variant="ghost"
              className="h-12 rounded-full bg-zinc-900 px-7 text-base font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Go to dashboard
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setAuthOpen(true)}
              className="h-12 rounded-full bg-zinc-900 px-7 text-base font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get started
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="mx-auto w-full max-w-[78rem] px-4">
          <div className="relative z-10 grid overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 sm:min-h-[260px] sm:grid-cols-[220px_1fr_280px] dark:border-white/10 dark:bg-[#111114]">
            <div className="flex flex-col gap-1 border-b border-zinc-200 p-5 sm:border-r sm:border-b-0 dark:border-white/10">
              <span className="mb-2 text-xs font-semibold tracking-wide text-zinc-500">
                DOCUMENTS
              </span>
              {documents.map((doc) => (
                <span
                  key={doc.name}
                  className={
                    doc.active
                      ? "rounded-md bg-violet-600/10 px-3 py-2 text-sm font-medium text-violet-700 dark:bg-violet-600/20 dark:text-violet-300"
                      : "rounded-md px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400"
                  }
                >
                  {doc.name}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-b border-zinc-200 p-5 sm:border-r sm:border-b-0 dark:border-white/10">
              <span className="h-2.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700/60" />
              <span className="h-2.5 w-4/5 rounded-full bg-zinc-200 dark:bg-zinc-700/60" />
              <span className="h-2.5 w-3/5 rounded-full bg-zinc-200 dark:bg-zinc-700/60" />
              <div className="rounded-md border-l-2 border-violet-400 bg-violet-50 px-4 py-3 text-sm text-zinc-700 dark:border-violet-500 dark:bg-violet-950/40 dark:text-zinc-200">
                Q3 revenue grew 18% quarter-over-quarter, driven by expansion
                in enterprise accounts...
              </div>
              <span className="h-2.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700/60" />
            </div>

            <div className="flex flex-col gap-3 p-5">
              <div className="self-end rounded-2xl rounded-br-sm bg-violet-600 px-4 py-2 text-sm font-medium text-white">
                What was Q3 revenue growth?
              </div>
              <div className="flex flex-col gap-2 rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <span>
                  Revenue grew <span className="font-bold">18% QoQ</span>, led
                  by enterprise{" "}
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                    1
                  </span>
                </span>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <FileText className="size-3" />
                Q3_Board_Deck.pdf · p.4
              </span>
            </div>
          </div>
        </div>

        <div className="pt-6 pb-48">
          <p className="mx-auto max-w-xl px-4 text-center text-lg font-medium text-zinc-600 dark:text-zinc-400">
            Your documents have answers. We help you find them in seconds.
          </p>
        </div>
      </div>

      <div id="features" className="scroll-mt-24 bg-zinc-50 dark:bg-[#050505]">
        <div className="mx-auto w-full max-w-[100rem] px-8 pt-20 pb-24">
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="text-4xl font-black tracking-tight text-zinc-900 sm:text-5xl dark:text-white">
              Everything you need to work with documents
            </h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Four building blocks that turn static files into a conversation.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-7 dark:border-white/10 dark:bg-[#111114]"
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-600/10 dark:text-violet-400">
                  <Icon className="size-5" />
                </span>
                <h3 className="font-bold text-zinc-900 dark:text-white">{title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        id="product"
        className="relative isolate flex scroll-mt-24 flex-col items-center gap-3 overflow-hidden border-t border-zinc-200 bg-zinc-50 px-4 py-28 text-center dark:border-white/10 dark:bg-[#050505]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0">
          <div
            className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-full dark:hidden"
            style={{
              top: "-250px",
              width: "min(1600px, 120vw)",
              height: "620px",
              filter: "blur(55px)",
              background:
                "radial-gradient(ellipse at 50% 58%, rgba(139,92,246,0.32) 0%, rgba(139,92,246,0.24) 30%, rgba(124,58,237,0.16) 55%, rgba(109,40,217,0.09) 78%, rgba(109,40,217,0.03) 100%)",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                opacity: 0.12,
                mixBlendMode: "overlay",
              }}
            />
          </div>
          <div
            className="absolute left-1/2 hidden -translate-x-1/2 overflow-hidden rounded-full dark:block"
            style={{
              top: "-250px",
              width: "min(1600px, 120vw)",
              height: "620px",
              filter: "blur(55px)",
              background:
                "radial-gradient(ellipse at 50% 58%, rgba(109,40,217,0.5) 0%, rgba(109,40,217,0.38) 30%, rgba(91,33,182,0.28) 55%, rgba(76,29,149,0.18) 78%, rgba(76,29,149,0.08) 100%)",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                opacity: 0.12,
                mixBlendMode: "overlay",
              }}
            />
          </div>
        </div>
        <h2 className="relative z-10 text-4xl font-black tracking-tight text-zinc-900 sm:text-5xl dark:text-white">
          An intuitive interface
        </h2>
        <p className="relative z-10 max-w-xl text-lg text-zinc-700 dark:text-white/80">
          Your library, the document and the conversation — always one glance
          away from each other.
        </p>

        <div
          className="relative z-10 mt-14 w-full max-w-[97rem] overflow-hidden rounded-[22px] border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#111114]"
          style={{
            boxShadow:
              "0 28px 80px rgba(109, 40, 217, 0.3), 0 14px 32px rgba(0, 0, 0, 0.45)",
          }}
        >
          <div className="flex items-center gap-1.5 border-b border-zinc-200 px-4 py-3 dark:border-white/10">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </div>

          <div className="grid min-h-[680px] text-left sm:grid-cols-[280px_1fr_365px]">
            <div className="flex flex-col gap-1 border-b border-zinc-200 p-5 sm:border-r sm:border-b-0 dark:border-white/10">
              <span className="mb-2 h-9 rounded-lg bg-zinc-100 dark:bg-white/5" />
              {documents.map((doc) => (
                <span
                  key={doc.name}
                  className={
                    doc.active
                      ? "rounded-md bg-violet-600/10 px-3 py-2 text-sm font-medium text-violet-700 dark:bg-violet-600/20 dark:text-violet-300"
                      : "rounded-md px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400"
                  }
                >
                  {doc.name}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-b border-zinc-200 p-5 sm:border-r sm:border-b-0 dark:border-white/10">
              <span className="h-2.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700/60" />
              <span className="h-2.5 w-4/5 rounded-full bg-zinc-200 dark:bg-zinc-700/60" />
              <span className="h-2.5 w-3/5 rounded-full bg-zinc-200 dark:bg-zinc-700/60" />
              <div className="rounded-md border-l-2 border-violet-400 bg-violet-50 px-4 py-3 text-sm text-zinc-700 dark:border-violet-500 dark:bg-violet-950/40 dark:text-zinc-200">
                Q3 revenue grew 18% quarter-over-quarter, driven by expansion
                in enterprise accounts...
              </div>
              <span className="h-2.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700/60" />
              <span className="h-2.5 w-4/5 rounded-full bg-zinc-200 dark:bg-zinc-700/60" />
            </div>

            <div className="flex flex-col gap-3 p-5">
              <div className="self-end rounded-2xl rounded-br-sm bg-violet-600 px-4 py-2 text-sm font-medium text-white">
                What was Q3 revenue growth?
              </div>
              <div className="flex flex-col gap-2 rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <span>
                  Revenue grew <span className="font-bold">18% QoQ</span>, led
                  by enterprise expansion{" "}
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                    1
                  </span>
                </span>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <FileText className="size-3" />
                Q3_Board_Deck.pdf · p.4
              </span>
            </div>
          </div>
        </div>
      </div>

      <section
        id="workflow"
        className="scroll-mt-24 border-t border-zinc-200 bg-zinc-100 px-6 py-28 text-center dark:border-white/10 dark:bg-[#17181b]"
      >
        <h2 className="text-4xl font-black tracking-tight text-zinc-900 sm:text-5xl dark:text-white">
          From document to answer in seconds
        </h2>

        <div className="mx-auto mt-20 grid max-w-6xl items-start gap-8 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:gap-10">
          {workflowSteps.map((step, index) => (
            <div key={step.number} className="contents">
              <div className="flex flex-col items-center">
                <span
                  className={
                    step.number === "4"
                      ? "flex size-[74px] items-center justify-center rounded-full bg-violet-500 text-2xl font-bold text-white"
                      : "flex size-[74px] items-center justify-center rounded-full border-2 border-zinc-300 text-2xl font-bold text-zinc-900 dark:border-white/15 dark:text-white"
                  }
                >
                  {step.number}
                </span>
                <h3 className="mt-5 text-xl font-bold text-zinc-900 dark:text-white">{step.title}</h3>
                <p className="mt-4 max-w-[220px] text-lg leading-snug text-zinc-600 dark:text-zinc-400">
                  {step.description}
                </p>
              </div>
              {index < workflowSteps.length - 1 && (
                <ArrowRight
                  key={`${step.number}-arrow`}
                  className="mx-auto hidden size-8 translate-y-6 text-zinc-400 md:block dark:text-zinc-500"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="rounded-b-[28px] border border-zinc-200 bg-white px-6 py-16 sm:px-14 dark:border-white/10 dark:bg-[#111114]">
        <div className="mx-auto flex max-w-[112rem] flex-col items-start justify-between gap-10 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-3 text-lg font-bold text-zinc-900 dark:text-white">
              <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500 text-xs font-black text-white">
                AI
              </span>
              AI Document Assistant
            </div>
            <p className="mt-6 max-w-xs text-lg leading-snug text-zinc-600 dark:text-zinc-400">
              The AI assistant that reads your documents so you don&apos;t have to.
            </p>
          </div>

          <div className="flex gap-8 text-lg font-medium text-zinc-700 dark:text-zinc-300">
            {marketingNavLinks.map(({ label, href }) => (
              <a key={label} href={href} className="hover:text-zinc-900 dark:hover:text-white">
                {label}
              </a>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-[112rem] border-t border-zinc-200 pt-7 text-base text-zinc-500 dark:border-white/10">
          © 2026 AI Document Assistant. All rights reserved.
        </div>
      </footer>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultView="register" />
    </div>
  );
}
