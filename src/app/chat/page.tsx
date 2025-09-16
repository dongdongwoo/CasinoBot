"use client";

import "../../components/jessexbt/markdown.css";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: number;
}

const CustomLink = ({
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  return (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecorationLine: "underline" }}
    >
      {children}
    </a>
  );
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasReceivedData = useRef(false);
  const currentAssistantMessageRef = useRef<Message | null>(null);
  const assistantMessageIdRef = useRef<string | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);
  const lastChunkRef = useRef<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSubmit = async (input: string) => {
    // e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);
    hasReceivedData.current = false;

    // Close any existing EventSource connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // Create new EventSource connection
      const eventSource = new EventSource(
        `${process.env.NEXT_PUBLIC_API_URL}/api/jesse-pr-workflow/vector-search/provide-builder-advice-streaming-qna/${encodeURIComponent(input)}`,
      );
      eventSourceRef.current = eventSource;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "",
        role: "assistant",
        timestamp: Date.now(),
      };

      currentAssistantMessageRef.current = assistantMessage;
      assistantMessageIdRef.current = assistantMessage.id;
      setMessages((prev) => [...prev, assistantMessage]);

      // Centralized cleanup to prevent auto-reconnect loops and truncation
      const finalize = (errorMessage?: string) => {
        if (errorMessage && !hasReceivedData.current) {
          setError(errorMessage);
        }
        setIsLoading(false);
        eventSource.close();
        eventSourceRef.current = null;
        currentAssistantMessageRef.current = null;
        assistantMessageIdRef.current = null;
        lastChunkRef.current = null;
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
          idleTimeoutRef.current = null;
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const content = event.data;
          // Handle common end-of-stream sentinels
          if (
            content === "[DONE]" ||
            content === "[done]" ||
            content === "DONE"
          ) {
            finalize();
            return;
          }
          if (content && currentAssistantMessageRef.current) {
            const trimmed =
              typeof content === "string"
                ? content.replace(/\r?\n$/, "")
                : content;

            // Ignore empty/heartbeat frames and exact duplicate chunks
            if (!trimmed || trimmed.trim().length === 0) return;
            if (lastChunkRef.current === trimmed) return;

            const existing = currentAssistantMessageRef.current.content || "";
            let nextText = existing;

            // Handle servers that resend cumulative snapshots or duplicate frames
            if (trimmed === existing) {
              return;
            }
            if (trimmed.startsWith(existing)) {
              nextText = trimmed; // snapshot replaces
            } else if (existing.startsWith(trimmed)) {
              return; // older snapshot
            } else {
              nextText = existing + trimmed; // delta append
            }

            // Only if content advanced do we mark as received and reset the idle timer
            hasReceivedData.current = true;
            if (idleTimeoutRef.current) {
              clearTimeout(idleTimeoutRef.current);
            }
            idleTimeoutRef.current = window.setTimeout(() => {
              finalize();
            }, 30000);

            lastChunkRef.current = trimmed;
            currentAssistantMessageRef.current.content = nextText;
            setMessages((prev) => {
              const newMessages = [...prev];
              const assistantIndex = newMessages.findIndex(
                (m) => m.id === assistantMessageIdRef.current,
              );
              if (assistantIndex !== -1) {
                const target = newMessages[assistantIndex];
                newMessages[assistantIndex] = {
                  ...target,
                  content: currentAssistantMessageRef.current?.content || "",
                };
              }
              return newMessages;
            });
          }
        } catch (error) {
          console.error("Error processing event data:", error);
        }
      };

      eventSource.onerror = (error) => {
        // If we've already received data, close immediately to avoid replay duplicates on auto-reconnect
        if (hasReceivedData.current) {
          console.warn(
            "EventSource error after data; finalizing to avoid duplicate replay",
            error,
          );
          finalize();
          return;
        }

        // Before any data is received, allow brief time for auto-reconnect; otherwise, surface error
        console.error("EventSource error before any data:", error);
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
        }
        idleTimeoutRef.current = window.setTimeout(() => {
          finalize("Connection error. Please try again.");
        }, 8000);
      };

      // Handle stream completion
      eventSource.addEventListener("done", () => {
        finalize();
      });
    } catch (error) {
      console.error("Error creating EventSource:", error);
      setError("Failed to connect. Please try again.");
      setIsLoading(false);
      currentAssistantMessageRef.current = null;
      assistantMessageIdRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      // Clear any idle timeout on unmount to avoid stray finalize calls
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea
        ref={scrollRef}
        className="h-[calc(100svh-48px)] flex-1 overflow-y-scroll px-4 desktop:h-[calc(100svh-64px)]"
      >
        <div className="mx-auto max-w-3xl space-y-4 py-4">
          {messages.map((message) => {
            if (message.content.length > 0) {
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex w-full items-start gap-2",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {message.role === "assistant" && (
                    <Avatar className="size-8">
                      <AvatarImage
                        src="/logo/seven_luck.png"
                        alt="Agent Jesse"
                      />
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[90%] whitespace-pre-wrap break-words rounded-lg px-2 py-2",
                      message.role === "user"
                        ? "bg-[#0052FF] text-primary-foreground"
                        : "bg-muted",
                    )}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: CustomLink,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              );
            }
            return null;
          })}
          {isLoading && !hasReceivedData.current && (
            <div className="flex w-full justify-start">
              <div className="w-full animate-fadeMoveUp rounded-lg opacity-0">
                <div className="flex w-full items-center gap-2">
                  {/* <Lightbulb className="size-4" /> */}
                  <Avatar className="size-8">
                    <AvatarImage src="/logo/seven_luck.png" alt="Seven Luck" />
                    {/* <AvatarFallback>AI</AvatarFallback> */}
                  </Avatar>
                  <p className="px-2 text-base font-semibold text-black/50">
                    CasinoBot is thinking...
                  </p>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-center">
              <div className="rounded-lg bg-destructive/10 px-4 py-2 text-destructive">
                {error}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="sticky bottom-0 bg-background p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit(input);
          }}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
