"use client";

import dagre from "dagre";
import {
  Background,
  Controls,
  Handle,
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
};

type ThreadMapViewProps = {
  messages: Message[];
  selectedMessageId: string | null;
  onSelectMessage: (id: string) => void;
};

type MessageNodeData = {
  author: string;
  text: string;
  timestamp: string;
  topic?: string;
  sentiment?: string;
  isSelected: boolean;
};

const NODE_WIDTH = 300;
const NODE_HEIGHT = 130;

function sentimentClasses(sentiment?: string) {
  switch (sentiment) {
    case "supportive":
      return "bg-green-100 text-green-800";
    case "critical":
      return "bg-red-100 text-red-800";
    case "mixed":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function MessageNode({ data }: NodeProps) {
  const typed = data as MessageNodeData;
  const styles = sentimentNodeStyles(typed.sentiment, typed.isSelected);

  return (
    <div className="rounded-xl p-3 shadow-sm transition overflow-hidden" style={{ width: NODE_WIDTH, ...styles }}>
      <Handle type="target" position={Position.Top} />

      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="font-semibold text-sm text-gray-900">{typed.author}</div>
        <div className="text-[10px] text-gray-500">
          {new Date(typed.timestamp).toLocaleDateString()}
        </div>
      </div>

      <div className="mb-3 text-xs leading-5 text-gray-700">
        {typed.text.length > 95 ? typed.text.slice(0, 95) + "..." : typed.text}
      </div>

      <div className="flex flex-wrap gap-2 text-[10px]">
        {typed.topic && (
          <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-800">
            {typed.topic}
          </span>
        )}
        <span
          className={`rounded-full px-2 py-1 ${sentimentClasses(typed.sentiment)}`}
        >
          {typed.sentiment ?? "neutral"}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  messageNode: MessageNode,
};

function sentimentNodeStyles(sentiment?: string, isSelected?: boolean) {
  const selectedRing = isSelected ? "2px solid #3b82f6" : "1px solid #d1d5db";

  switch (sentiment) {
    case "supportive":
      return {
        border: isSelected ? "2px solid #3b82f6" : "1px solid #86efac",
        background: isSelected ? "#eff6ff" : "#f0fdf4",
      };
    case "critical":
      return {
        border: isSelected ? "2px solid #3b82f6" : "1px solid #fca5a5",
        background: isSelected ? "#eff6ff" : "#fef2f2",
      };
    case "mixed":
      return {
        border: isSelected ? "2px solid #3b82f6" : "1px solid #fcd34d",
        background: isSelected ? "#eff6ff" : "#fffbeb",
      };
    default:
      return {
        border: selectedRing,
        background: isSelected ? "#eff6ff" : "white",
      };
  }
}

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const dagreGraph = new dagre.graphlib.Graph();

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "TB",
    ranksep: 110,
    nodesep: 50,
    marginx: 20,
    marginy: 20,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function buildTreeGraph(
  messages: Message[],
  selectedMessageId: string | null
): { nodes: Node[]; edges: Edge[] } {
  const messageIds = new Set(messages.map((m) => m.id));

  const nodes: Node[] = messages.map((msg) => ({
    id: msg.id,
    type: "messageNode",
    position: { x: 0, y: 0 },
    data: {
      author: msg.author,
      text: msg.text,
      timestamp: msg.timestamp,
      topic: msg.topic,
      sentiment: msg.sentiment,
      isSelected: msg.id === selectedMessageId,
    },
  }));

  const edges: Edge[] = messages
    .filter((msg) => msg.parentId && messageIds.has(msg.parentId))
    .map((msg) => ({
      id: `${msg.parentId}-${msg.id}`,
      source: msg.parentId!,
      target: msg.id,
      type: "bezier",
      animated: false,
    }));

  return getLayoutedElements(nodes, edges);
}

export default function ThreadMapView({
  messages,
  selectedMessageId,
  onSelectMessage,
}: ThreadMapViewProps) {
  const { nodes, edges } = buildTreeGraph(messages, selectedMessageId);

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    onSelectMessage(node.id);
  };

  return (
    <div className="h-[700px] w-full rounded-xl border bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        onNodeClick={handleNodeClick}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}