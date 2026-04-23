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

type Props = {
  selectedMessage: Message | null;
  parentMessage: Message | null;
  sheetOpen: boolean;
  onCloseSheet: () => void;
  initials: (name: string) => string;
  sentimentBadgeClass: (sentiment?: string) => string;
  getEffectiveParentId: (msg: Message) => string | null;
  isAiOnlyReply: (msg: Message) => boolean;
};

export default function UserMessageDetailSheet({
  selectedMessage,
  parentMessage,
  sheetOpen,
  onCloseSheet,
  initials,
  sentimentBadgeClass,
  getEffectiveParentId,
  isAiOnlyReply,
}: Props) {
  if (!selectedMessage) return null;

  return (
    <div
      className={`fixed bottom-0 w-full -translate-x-1/2 
        rounded-t-[20px] border-t border-[#d4ddd0] bg-[#fafaf8] px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)] 
        shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-transform duration-100 ${
        sheetOpen ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mb-3 flex justify-end">
        <button
          onClick={onCloseSheet}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4ebe0] text-sm font-semibold text-[#4A5E42] hover:bg-[#d6e0d2]"
          aria-label="Close detail panel"
        >
          ×
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d6e0d2] text-xs font-semibold text-[#2B3A2B]">
          {initials(selectedMessage.author)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-[#2B3A2B]">
            {selectedMessage.author}
          </div>
          <div className="truncate text-[11px] text-[#8BA07A]">
            {selectedMessage.timestamp}
          </div>
        </div>
      </div>

      <div className="mb-3 border-y border-[#d4ddd0] py-3 text-[13px] leading-[1.55] text-[#4A5E42]">
        {selectedMessage.text}
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedMessage.topic && (
          <span className="rounded-full bg-[#e4ebe0] px-2.5 py-1 text-[11px] font-medium text-[#4A5E42]">
            {selectedMessage.topic}
          </span>
        )}

        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${sentimentBadgeClass(
            selectedMessage.sentiment
          )}`}
        >
          {selectedMessage.sentiment ?? "neutral"}
        </span>

        {getEffectiveParentId(selectedMessage) && parentMessage && (
          <span className="rounded-full bg-[#ddeedd] px-2.5 py-1 text-[11px] font-medium text-[#3D6B35]">
            replying to {parentMessage.author}
            {isAiOnlyReply(selectedMessage) ? " ★" : ""}
          </span>
        )}
      </div>
    </div>
  );
}