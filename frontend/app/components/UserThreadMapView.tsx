"use client";

import { useMemo } from "react";
import dagre from "dagre";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

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
  messages: Message[];
  selectedMessageId: string | null;
  onSelectMessage: (id: string) => void;
};

type MessageNodeData = {
  author: string;
  text: string;
  sentiment?: string;
  isSelected: boolean;
  showInferredStar: boolean;
};

const NODE_WIDTH = 100;
const NODE_HEIGHT = 48;

function sentimentNodeStyle(sentiment?: string, isSelected?: boolean) {
  const selectedBorder = "2px solid #3D6B35";

  switch (sentiment) {
    case "supportive":
      return {
        background: "#ddeedd",
        border: isSelected
          ? selectedBorder
          : "1px solid rgba(168,184,154,0.6)",
        color: "#2B6B2B",
      };
    case "critical":
      return {
        background: "#fde8df",
        border: isSelected
          ? selectedBorder
          : "1px solid rgba(168,184,154,0.6)",
        color: "#712B13",
      };
    case "mixed":
      return {
        background: "#fffbeb",
        border: isSelected
          ? selectedBorder
          : "1px solid rgba(168,184,154,0.6)",
        color: "#7A3E00",
      };
    default:
      return {
        background: "#fdefd8",
        border: isSelected
          ? selectedBorder
          : "1px solid rgba(168,184,154,0.6)",
        color: "#7A3E00",
      };
  }
}

function wrapText(text: string, max = 16) {
  if (text.length <= max) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = `${current} ${word}`.trim();
    if (next.length <= max) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  return lines.slice(0, 2).map((line, i, arr) =>
    i === arr.length - 1 && text.length > max * 2
      ? `${line.slice(0, max - 1)}…`
      : line
  );
}

function MessageNode({ data }: NodeProps) {
  const typed = data as MessageNodeData;
  const style = sentimentNodeStyle(typed.sentiment, typed.isSelected);
  const lines = wrapText(typed.text);

  return (
    <div
      className="rounded-[8px] px-2 py-1 shadow-sm"
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        ...style,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 1, height: 1, border: 0 }}
      />
      <div className="mb-0.5 text-center text-[9px] font-semibold">
        {typed.author}
        {typed.showInferredStar ? " ★" : ""}
      </div>
      {lines.map((line, idx) => (
        <div
          key={idx}
          className="text-center text-[9px] leading-[11px] opacity-90"
        >
          {line}
        </div>
      ))}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 1, height: 1, border: 0 }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  messageNode: MessageNode,
};

function getEffectiveParentId(msg: Message) {
  return msg.inferredReplyToId ?? msg.parentId ?? null;
}

function isAiOnlyInferredReply(msg: Message) {
  return !msg.parentId && !!msg.inferredReplyToId && !!msg.replyInferred;
}

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    ranksep: 48,
    nodesep: 28,
    marginx: 18,
    marginy: 16,
  });

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  return {
    nodes: nodes.map((node) => {
      const pos = graph.node(node.id);
      return {
        ...node,
        position: {
          x: pos.x - NODE_WIDTH / 2,
          y: pos.y - NODE_HEIGHT / 2,
        },
      };
    }),
    edges,
  };
}

export default function UserThreadMapView({
  messages,
  selectedMessageId,
  onSelectMessage,
}: Props) {
  const layouted = useMemo(() => {
    const messageIds = new Set(messages.map((m) => m.id));

    const nodes: Node[] = messages.map((msg) => ({
      id: msg.id,
      type: "messageNode",
      position: { x: 0, y: 0 },
      data: {
        author: msg.author,
        text: msg.text,
        sentiment: msg.sentiment,
        isSelected: msg.id === selectedMessageId,
        showInferredStar: isAiOnlyInferredReply(msg),
      },
    }));

    const edges: Edge[] = messages.flatMap((msg): Edge[] => {
      const parentId = getEffectiveParentId(msg);
      if (!parentId || !messageIds.has(parentId)) return [];

      const aiOnlyInferred = isAiOnlyInferredReply(msg);

      const stroke = aiOnlyInferred ? "#A8B89A" : "#7a8e73";

      const edge: Edge = {
        id: `${parentId}-${msg.id}`,
        source: parentId,
        target: msg.id,
        type: "smoothstep",
        animated: aiOnlyInferred,
        style: aiOnlyInferred
          ? {
              stroke,
              strokeWidth: 1.4,
              strokeDasharray: "4 3",
              strokeLinecap: "round",
            }
          : {
              stroke,
              strokeWidth: 1.6,
              strokeLinecap: "round",
            },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: stroke,
        },
      };

      (edge as Edge & { pathOptions?: { borderRadius?: number; offset?: number } }).pathOptions = {
        borderRadius: 16,
        offset: 12,
      };

      return [edge];
    });

    return getLayoutedElements(nodes, edges);
  }, [messages, selectedMessageId]);

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    onSelectMessage(node.id);
  };

  return (
    <div className="h-full w-full overflow-hidden rounded-xl bg-transparent">
      <ReactFlow
        nodes={layouted.nodes}
        edges={layouted.edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.6}
        maxZoom={1.5}
      >

        
        <Background gap={20} size={1} color="#e4ebe0" />
        <Controls />
      </ReactFlow>
    </div>

    
  );
}