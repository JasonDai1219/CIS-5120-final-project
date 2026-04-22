import { useEffect, useRef } from "react";

type Message = {
  id: string;
  author: string;
  timestamp: string;
  text: string;
  parentId: string | null;
  topic?: string;
  sentiment?: string;
  inferredReplyToId?: string | null;
  replyInferred?: boolean;
};

type TimeGranularity = "day" | "week" | "month";

type Props = {
  messages: Message[];
  messagesById: Record<string, Message>;
  messageRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  selectedMessage: Message | null;
  sheetOpen: boolean;
  onOpenMessage: (msg: Message) => void;
  onCloseSheet: () => void;
  parentMessage: Message | null;
  timeGranularity: TimeGranularity;
  onJumpToParent: (parent: Message, current: Message) => void;
};

function sentimentBadgeClass(sentiment?: string) {
  switch (sentiment) {
    case "supportive": return "bg-green-100 text-green-800";
    case "critical":   return "bg-red-100 text-red-800";
    case "mixed":      return "bg-yellow-100 text-yellow-800";
    default:           return "bg-gray-100 text-gray-700";
  }
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function getEffectiveParentId(msg: Message) {
  return msg.parentId ?? msg.inferredReplyToId ?? null;
}

function isAiOnlyReply(msg: Message) {
  return !msg.parentId && !!msg.inferredReplyToId && !!msg.replyInferred;
}



export default function UserChatView({
  messages,
  messagesById,
  messageRefs,
  selectedMessage,
  sheetOpen,
  onOpenMessage,
  onCloseSheet,
  parentMessage,
  onJumpToParent,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {/* Scrollable message list — justify-end keeps messages at the bottom when few */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto overflow-x-hidden px-4 py-3 flex flex-col justify-end"
      >
        <div className="flex min-w-0 flex-col gap-2 pb-4">
          {messages.map((msg) => {
            const parent = messagesById[getEffectiveParentId(msg) ?? ""];
            const inferred = isAiOnlyReply(msg);

            return (
              <div
                key={msg.id}
                ref={(el) => { messageRefs.current[msg.id] = el; }}
                role="button"
                tabIndex={0}
                onClick={() => onOpenMessage(msg)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenMessage(msg);
                  }
                }}
                className="flex min-w-0 cursor-pointer items-start gap-2 rounded-[12px] text-left transition"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d6e0d2] text-[10px] font-semibold text-[#2B3A2B]">
                  {initials(msg.author)}
                </div>

                <div className="min-w-0 max-w-[260px] rounded-[16px] rounded-bl-[4px] bg-[#eef2eb] px-3 py-2">
                  {parent && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onJumpToParent(parent, msg); }}
                      className="mb-2 block w-full min-w-0 rounded-[10px] bg-[#dfe8d8] px-2.5 py-2 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-1 text-[10px] font-medium text-[#5C7A4E]">
                        <span className="truncate">Replying to {parent.author}</span>
                        {inferred && <span className="shrink-0" title="AI-inferred reply">★</span>}
                      </div>
                      <div className="truncate text-[10px] text-[#7c8f70]">{parent.text}</div>
                    </button>
                  )}

                  <div className="mb-1 text-[11px] font-semibold text-[#3D6B35]">{msg.author}</div>

                  <div className="break-words text-[13px] leading-[1.45] text-[#2B3A2B]">
                    {msg.text}
                  </div>

                  <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 text-[10px] text-[#8BA07A]">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sentimentBadgeClass(msg.sentiment)}`}>
                      {msg.sentiment ?? "neutral"}
                    </span>
                    {inferred && (
                      <span className="shrink-0 text-[10px] text-[#5C7A4E]" title="AI-inferred reply">★</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}