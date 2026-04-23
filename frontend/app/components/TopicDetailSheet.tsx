"use client";

type Topic = {
  id: string;
  parentId: string | null;
  position: { x: number; y: number };
  topicTitle: string;
  aiSummary: string;
  senderName: string;
  messageText: string;
  timestamp: string;
  sentiment?: string;
  inferredReplyToId?: string | null;
  replyInferred?: boolean;
  isRoot: boolean;
  hasChildren: boolean;
};

type Props = {
  selectedTopic: Topic | null;
  sheetOpen: boolean;
  onCloseSheet: () => void;
};

export default function TopicDetailSheet({
  selectedTopic,
  sheetOpen,
  onCloseSheet,
}: Props) {
  if (!selectedTopic) return null;

  return (
    <div
      className={`fixed bottom-0 left-1/2 z-50 w-full -translate-x-1/2 rounded-t-[20px] border-t border-[#d4ddd0] bg-[#fafaf8] px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ${
        sheetOpen ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mb-3 flex justify-end">
        <button
          onClick={onCloseSheet}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4ebe0] text-sm font-semibold text-[#4A5E42] hover:bg-[#d6e0d2]"
          aria-label="Close topic detail panel"
        >
          ×
        </button>
      </div>

      <div className="mb-3">
        <div className="text-[18px] font-semibold text-[#2B3A2B]">
          {selectedTopic.topicTitle}
        </div>
        <div className="mt-1 text-[11px] text-[#8BA07A]">
          {selectedTopic.isRoot ? "Root topic" : "Child topic"}
          {selectedTopic.hasChildren ? " • Has children" : " • Leaf topic"}
        </div>
      </div>

      <div className="mb-3 border-y border-[#d4ddd0] py-3 text-[13px] leading-[1.6] text-[#4A5E42]">
        {selectedTopic.aiSummary}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[#e4ebe0] px-2.5 py-1 text-[11px] font-medium text-[#4A5E42]">
          Topic
        </span>

        {selectedTopic.parentId && (
          <span className="rounded-full bg-[#ddeedd] px-2.5 py-1 text-[11px] font-medium text-[#3D6B35]">
            child of {selectedTopic.parentId}
          </span>
        )}

        <span className="rounded-full bg-[#eef2ea] px-2.5 py-1 text-[11px] font-medium text-[#4A5E42]">
          {selectedTopic.hasChildren ? "expandable" : "no children"}
        </span>
      </div>
    </div>
  );
}