"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, MessageCircle, Search, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProfileAvatar } from "@/components/profile-avatar";
import { createClient } from "@/lib/supabase/client";

type Participant = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  isVerified: boolean;
};
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
type Conversation = {
  id: string;
  createdAt: string;
  isUnread: boolean;
  participant: Participant;
  latestMessage: Pick<Message, "id" | "body" | "sender_id" | "created_at"> | null;
};

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef(conversations);
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    let active = true;

    async function loadInbox() {
      try {
        const response = await fetch("/api/messages/conversations");
        const data = await response.json();
        if (response.status === 401) {
          if (active) setSignedOut(true);
          return;
        }
        if (!response.ok) throw new Error(data.message ?? "Unable to load your inbox.");
        if (active) {
          setConversations(data.conversations ?? []);
          const params = new URLSearchParams(window.location.search);
          const requestedConversation = params.get("conversation");
          if (requestedConversation) {
            setLoadingMessages(true);
            setSelectedId(requestedConversation);
          } else {
            const profileId = params.get("with");
            if (profileId) {
              const startResponse = await fetch("/api/messages/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profileId }),
              });
              const startData = await startResponse.json();
              if (!startResponse.ok) throw new Error(startData.message ?? "Unable to start a conversation.");
              if (!active) return;
              setLoadingMessages(true);
              setSelectedId(startData.conversationId);
              const refreshed = await fetch("/api/messages/conversations");
              const refreshedData = await refreshed.json();
              if (!refreshed.ok) throw new Error(refreshedData.message ?? "Unable to load your inbox.");
              if (active) setConversations(refreshedData.conversations ?? []);
              router.replace(`/messages?conversation=${encodeURIComponent(startData.conversationId)}`);
            }
          }
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load your inbox.");
      } finally {
        if (active) setLoadingInbox(false);
      }
    }

    void loadInbox();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const channel = supabase
      .channel(`inbox-messages-${crypto.randomUUID()}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        const row = payload.new;
        if (
          typeof row.id !== "string"
          || typeof row.conversation_id !== "string"
          || typeof row.sender_id !== "string"
          || typeof row.body !== "string"
          || typeof row.created_at !== "string"
        ) return;
        const incoming = row as Message;
        setConversations((current) => current.map((conversation) => {
          if (conversation.id !== incoming.conversation_id) return conversation;
          const isFromOtherPerson = incoming.sender_id === conversation.participant.id;
          return {
            ...conversation,
            latestMessage: incoming,
            isUnread: isFromOtherPerson && conversation.id !== selectedId,
          };
        }).sort((a, b) =>
          (b.latestMessage?.created_at ?? b.createdAt).localeCompare(a.latestMessage?.created_at ?? a.createdAt),
        ));

        if (incoming.sender_id !== conversationsRef.current.find((conversation) => conversation.id === incoming.conversation_id)?.participant.id) return;
        if (selectedId === incoming.conversation_id) {
          void fetch(`/api/messages/conversations/${encodeURIComponent(incoming.conversation_id)}/read`, { method: "POST" })
            .then((response) => {
              if (!response.ok) console.error("Unable to mark active conversation read.");
            })
            .catch((cause: unknown) => console.error("Unable to mark active conversation read.", cause));
        } else {
          window.dispatchEvent(new Event("buildup-unread-updated"));
        }
      })
      .subscribe((status, subscriptionError) => {
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && active) {
          console.error("Inbox Realtime subscription failed.", subscriptionError);
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    let active = true;

    const supabase = createClient();
    const channel = supabase
      .channel(`conversation-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => {
          const row = payload.new;
          if (
            typeof row.id !== "string"
            || typeof row.conversation_id !== "string"
            || typeof row.sender_id !== "string"
            || typeof row.body !== "string"
            || typeof row.created_at !== "string"
          ) return;
          const incoming = row as Message;
          setMessages((current) => current.some((message) => message.id === incoming.id)
            ? current
            : [...current, incoming].sort((a, b) =>
                a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
              ));
          if (incoming.sender_id === selectedConversation?.participant.id) {
            void fetch(`/api/messages/conversations/${encodeURIComponent(selectedId)}/read`, { method: "POST" })
              .then((response) => {
                if (!response.ok) console.error("Unable to mark active conversation read.");
                else window.dispatchEvent(new Event("buildup-unread-updated"));
              })
              .catch((cause: unknown) => console.error("Unable to mark active conversation read.", cause));
          }
        },
      )
      .subscribe((status, subscriptionError) => {
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && active) {
          console.error("Message Realtime subscription failed.", subscriptionError);
        }
      });

    fetch(`/api/messages/conversations/${encodeURIComponent(selectedId)}/messages`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Unable to load messages.");
        if (active) {
          setMessages((current) => {
            const merged = new Map(current.map((message) => [message.id, message]));
            for (const message of data.messages as Message[]) merged.set(message.id, message);
            return [...merged.values()].sort((a, b) =>
              a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
            );
          });
          setConversations((current) => current.map((conversation) =>
            conversation.id === selectedId ? { ...conversation, isUnread: false } : conversation,
          ));
          window.dispatchEvent(new Event("buildup-unread-updated"));
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load messages.");
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedId, selectedConversation?.participant.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function openConversation(conversation: Conversation) {
    setMessages([]);
    setLoadingMessages(true);
    setSelectedId(conversation.id);
    setConversations((current) => current.map((item) =>
      item.id === conversation.id ? { ...item, isUnread: false } : item,
    ));
    window.dispatchEvent(new Event("buildup-unread-updated"));
    setError("");
    router.push(`/messages?conversation=${encodeURIComponent(conversation.id)}`);
  }

  function returnToInbox() {
    setMessages([]);
    setLoadingMessages(false);
    setSelectedId(null);
    router.push("/messages");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!selectedId || !body || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/messages/conversations/${encodeURIComponent(selectedId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Unable to send message.");
      const sent = data.message as Message;
      setMessages((current) => current.some((message) => message.id === sent.id)
        ? current
        : [...current, sent].sort((a, b) =>
            a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
          ));
      setConversations((current) => current.map((conversation) =>
        conversation.id === selectedId
          ? { ...conversation, latestMessage: sent, isUnread: false }
          : conversation,
      ).sort((a, b) =>
        (b.latestMessage?.created_at ?? b.createdAt).localeCompare(a.latestMessage?.created_at ?? a.createdAt),
      ));
      window.dispatchEvent(new Event("buildup-unread-updated"));
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  if (signedOut) {
    return (
      <AppShell title="Messages">
        <section className="px-5 py-16 text-center">
          <MessageCircle className="mx-auto text-[var(--muted)]" size={28} />
          <p className="mt-4 text-sm">Sign in to view your messages.</p>
          <Link href="/login" className="mt-4 inline-flex min-h-10 items-center rounded-full bg-[var(--blue)] px-5 text-sm font-semibold text-white">Sign in</Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title="Messages">
      <section className="min-h-[calc(100dvh-160px)] px-4 pb-5 pt-5 sm:px-0">
        {selectedId ? (
          <div className="flex min-h-[calc(100dvh-190px)] flex-col">
            <header className="flex items-center gap-3 border-b hairline px-1 pb-4">
              <button type="button" onClick={returnToInbox} aria-label="Back to inbox" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.06]">
                <ArrowLeft size={19} />
              </button>
              {selectedConversation ? (
                <Link href={`/creator/${encodeURIComponent(selectedConversation.participant.handle)}`} className="flex min-w-0 items-center gap-3">
                  <ProfileAvatar src={selectedConversation.participant.avatarUrl} alt="" className="h-10 w-10" iconSize={20} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{selectedConversation.participant.name}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">{selectedConversation.participant.handle}</span>
                  </span>
                </Link>
              ) : <span className="text-sm font-semibold">Conversation</span>}
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto py-5" aria-label="Messages">
              {loadingMessages && messages.length === 0 && <div className="flex justify-center py-10"><LoaderCircle size={20} className="animate-spin text-[var(--muted)]" /></div>}
              {!loadingMessages && messages.length === 0 && !error && (
                <div className="py-12 text-center">
                  <MessageCircle className="mx-auto text-[var(--muted)]" size={25} />
                  <p className="mt-3 text-sm font-medium">Start the conversation</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Send a message to {selectedConversation?.participant.name ?? "this creator"}.</p>
                </div>
              )}
              {messages.map((message) => {
                const mine = message.sender_id !== selectedConversation?.participant.id;
                return (
                  <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <p className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${mine ? "rounded-br-md bg-[var(--blue)] text-white" : "rounded-bl-md bg-white/[0.07] text-[#eeeae5]"}`}>
                      {message.body}
                    </p>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {error && <p role="alert" className="mb-2 text-xs text-rose-300">{error}</p>}
            <form onSubmit={(event) => void sendMessage(event)} className="sticky bottom-[4.6rem] flex items-end gap-2 border-t hairline bg-[var(--background)] py-3">
              <textarea
                aria-label="Write a message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                maxLength={4000}
                rows={1}
                placeholder="Write a message…"
                className="max-h-32 min-h-10 flex-1 resize-y rounded-2xl border hairline bg-white/[0.035] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--muted)] focus:border-white/20"
              />
              <button type="submit" aria-label="Send message" disabled={!draft.trim() || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-white disabled:cursor-not-allowed disabled:opacity-45">
                {sending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            </form>
          </div>
        ) : (
          <>
            <header className="mb-4 flex items-center justify-between px-1">
              <h1 className="font-display text-xl font-semibold">Messages</h1>
              <Link href="/search" aria-label="Find people to message" title="Find people to message" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.06] hover:text-white">
                <Search size={18} />
              </Link>
            </header>
            {error && <p role="alert" className="mb-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-xs text-rose-300">{error}</p>}
            {loadingInbox ? (
              <div className="flex justify-center py-16"><LoaderCircle size={21} className="animate-spin text-[var(--muted)]" /></div>
            ) : conversations.length > 0 ? (
              <div className="divide-y divide-white/[0.07]">
                {conversations.map((conversation) => (
                  <button key={conversation.id} type="button" onClick={() => openConversation(conversation)} className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-white/[0.025]">
                    <ProfileAvatar src={conversation.participant.avatarUrl} alt="" className="h-12 w-12" iconSize={23} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className={`truncate text-sm ${conversation.isUnread ? "font-bold text-white" : "font-semibold"}`}>{conversation.participant.name}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <time className="text-[10px] text-[var(--muted)]">{formatMessageTime(conversation.latestMessage?.created_at ?? conversation.createdAt)}</time>
                          {conversation.isUnread && <span aria-label="Unread message" className="h-2 w-2 rounded-full bg-rose-500" />}
                        </span>
                      </span>
                      <span className={`mt-1 block truncate text-xs ${conversation.isUnread ? "font-medium text-white/80" : "text-[var(--muted)]"}`}>
                        {conversation.latestMessage
                          ? `${conversation.latestMessage.sender_id === conversation.participant.id ? "" : "You: "}${conversation.latestMessage.body}`
                          : conversation.participant.handle}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center px-5 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border hairline bg-white/[0.04] text-[var(--muted)]">
                  <MessageCircle size={21} strokeWidth={1.7} />
                </span>
                <p className="mt-4 text-sm font-medium">Your inbox is empty</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--muted)]">Visit a creator’s profile and choose Message to start a private conversation.</p>
                <Link href="/search" className="mt-4 inline-flex min-h-9 items-center rounded-full border hairline px-4 text-xs font-semibold text-white hover:bg-white/[0.05]">Find creators</Link>
              </div>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}
