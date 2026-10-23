"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Check, CornerDownLeft, RotateCcw } from "lucide-react";
import { postChat } from "@/lib/api-client";
import type { ChatMessage, ChatResult } from "@/lib/chat";
import { money } from "@/lib/format";
import { describeFilters, searchQuery } from "@/lib/listing";

const STORAGE_KEY = "ciooh.chat.v1";
const MAX_CHARS = 800;

const GREETING =
  "Tell me who's moving in, your yearly income, what you pay in rent, and how much you have saved. A zip code is optional: skip it and I'll search all of Houston. Add anything the home needs, like a yard or an extra bedroom. I'm an automated assistant running on Google Gemini, so check anything important.";

const EXAMPLES = [
  "We're a couple with 3 kids in 77044. We earn $85,000 a year, pay $2,100 rent and have $25,000 saved. We'd love a yard.",
  "Just me and my dog. I make $62,000, pay $1,500 rent, have $12,000 saved, and don't want a condo. Anywhere in Houston.",
];

type Saved = { messages: ChatMessage[]; result: ChatResult | null };

export function HomeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [result, setResult] = useState<ChatResult | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { messages, result } = JSON.parse(saved) as Saved;
        if (Array.isArray(messages)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after hydration
          setMessages(messages);
          setResult(result ?? null);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const persist = (next: Saved) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const history: ChatMessage[] = [...messages, { role: "user", text: trimmed.slice(0, MAX_CHARS) }];
    setMessages(history);
    setDraft("");
    setError(null);

    startTransition(async () => {
      let res: ChatResult;
      try {
        res = await postChat(history.slice(-24));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't reach the assistant. Try again.");
        setMessages(messages);
        setDraft(trimmed);
        return;
      }
      const next = [...history, { role: "assistant" as const, text: res.reply }];
      const nextResult: ChatResult = { reply: res.reply, search: res.search, known: res.known };
      setMessages(next);
      setResult(nextResult);
      persist({ messages: next, result: nextResult });
    });
  };

  const reset = () => {
    setMessages([]);
    setResult(null);
    setError(null);
    setDraft("");
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    inputRef.current?.focus();
  };

  const known = result?.known;
  const extras = known ? describeFilters({ ...known.filters, minBeds: undefined }) : [];
  const checklist = [
    { label: "Yearly income", value: known?.income != null ? `${money(known.income)}/yr` : null },
    { label: "Monthly rent", value: known?.rent != null ? `${money(known.rent)}/mo` : null },
    { label: "Savings", value: known?.savings != null ? money(known.savings) : null },
    {
      label: "Who's moving in",
      value:
        known?.filters.minBeds !== undefined
          ? `${known.householdSize != null ? `${known.householdSize} ${known.householdSize === 1 ? "person" : "people"}, ` : ""}${known.filters.minBeds}+ bedrooms`
          : null,
    },
  ];

  return (
    <div className="grid overflow-hidden rounded-xl border border-line bg-card lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-h-[26rem] flex-col">
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className="max-h-[28rem] flex-1 space-y-4 overflow-y-auto p-5 sm:p-6"
        >
          <AssistantBubble text={GREETING} />
          {messages.map((m, i) =>
            m.role === "user" ? <UserBubble key={i} text={m.text} /> : <AssistantBubble key={i} text={m.text} />,
          )}
          {pending && (
            <p className="flex items-center gap-1.5 text-sm text-ink-3" aria-label="Assistant is typing">
              <span className="size-1.5 animate-pulse rounded-full bg-ink-3" />
              <span className="size-1.5 animate-pulse rounded-full bg-ink-3 [animation-delay:150ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-ink-3 [animation-delay:300ms]" />
            </p>
          )}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setDraft(ex);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-line px-3 py-1.5 text-left text-sm text-ink-2 hover:border-ink-3 hover:text-ink"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          className="border-t border-line p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          {error && (
            <p role="alert" className="mb-2 text-sm text-over">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">
              Describe what you need
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              rows={2}
              maxLength={MAX_CHARS}
              placeholder="We're a family of four, earning $90,000, paying $1,900 rent, with $20,000 saved..."
              className="field max-h-40 min-h-[3rem] flex-1 resize-y"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              className="inline-flex h-12 items-center gap-1.5 rounded-md bg-navy px-4 font-semibold text-on-navy disabled:opacity-40"
            >
              Send <CornerDownLeft className="size-4" aria-hidden />
            </button>
          </div>
        </form>
      </div>

      <aside className="border-t border-line bg-sunk/60 p-5 sm:p-6 lg:border-l lg:border-t-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">What I know so far</p>
        <ul className="mt-4 space-y-3">
          {checklist.map((item) => (
            <li key={item.label} className="flex gap-2.5">
              <span
                aria-hidden
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                  item.value ? "bg-good text-card" : "border border-dashed border-ink-3"
                }`}
              >
                {item.value && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span>
                <span className="block text-sm text-ink-2">{item.label}</span>
                <span className={`block font-medium ${item.value ? "" : "text-ink-3"}`}>
                  {item.value ?? "Still needed"}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-2">
          Where: <span className="font-medium text-ink">{known?.zip ? `Zip ${known.zip}` : "All of Houston"}</span>
        </p>
        {extras.length > 0 && (
          <div className="mt-5">
            <p className="text-sm text-ink-2">Also looking for</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {extras.map((x) => (
                <li key={x} className="rounded-full bg-card px-2.5 py-0.5 text-sm">
                  {x}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-6 space-y-3">
          {result?.search ? (
            <Link
              key={searchQuery(result.search)}
              href={`/homes?${searchQuery(result.search)}`}
              className="nudge group flex items-center justify-center gap-2 rounded-md bg-navy px-4 py-3 font-semibold text-on-navy"
            >
              Show matching homes <ArrowRight className="nudge-arrow size-4 transition-transform" aria-hidden />
            </Link>
          ) : (
            <p className="text-sm text-ink-3">The search button shows up once income, rent, savings and household are filled in.</p>
          )}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-sm text-ink-2 underline underline-offset-4"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Start over
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <div className="max-w-[85%]">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Assistant</p>
      <p className="whitespace-pre-line text-ink">{text}</p>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-navy px-4 py-2.5 text-on-navy">
        {text}
      </p>
    </div>
  );
}
