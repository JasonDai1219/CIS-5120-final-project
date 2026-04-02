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

type TopicNodeData = {
  topic: string;
  count: number;
  sentiments: Record<string, number>;
  isSelected: boolean;
};

type TopicGraphEdge = {
  source: string;
  target: string;
  weight: number;
};

type TopicGraph = {
  topics: {
    topic: string;
    count: number;
    sentiments: Record<string, number>;
  }[];
  edges: TopicGraphEdge[];
};

type Props = {
  graph: TopicGraph;
  selectedTopic: string | null;
  onSelectTopic: (topic: string) => void;
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;

function dominantSentiment(sentiments: Record<string, number>) {
  let best = "neutral";
  let bestCount = -1;

  for (const [key, value] of Object.entries(sentiments)) {
    if (value > bestCount) {
      best = key;
      bestCount = value;
    }
  }

  return best;
}

function topicNodeStyles(sentiment: string, isSelected: boolean) {
  switch (sentiment) {
    case "supportive":
      return {
        border: isSelected ? "2px solid #2563eb" : "1px solid #86efac",
        background: "#f0fdf4",
      };
    case "critical":
      return {
        border: isSelected ? "2px solid #2563eb" : "1px solid #fca5a5",
        background: "#fef2f2",
      };
    case "mixed":
      return {
        border: isSelected ? "2px solid #2563eb" : "1px solid #fcd34d",
        background: "#fffbeb",
      };
    default:
      return {
        border: isSelected ? "2px solid #2563eb" : "1px solid #d1d5db",
        background: "white",
      };
  }
}

function TopicNode({ data }: NodeProps) {
  const typed = data as TopicNodeData;
  const dom = dominantSentiment(typed.sentiments);
  const styles = topicNodeStyles(dom, typed.isSelected);

  return (
    <div className="w-[220px] rounded-xl p-3 shadow-sm" style={styles}>
      <Handle type="target" position={Position.Top} />

      <div className="mb-2 text-sm font-semibold text-gray-900">{typed.topic}</div>

      <div className="mb-2 text-xs text-gray-700">Messages: {typed.count}</div>

      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className="rounded bg-green-100 px-2 py-1 text-green-800">
          S: {typed.sentiments.supportive ?? 0}
        </span>
        <span className="rounded bg-red-100 px-2 py-1 text-red-800">
          C: {typed.sentiments.critical ?? 0}
        </span>
        <span className="rounded bg-gray-100 px-2 py-1 text-gray-700">
          N: {typed.sentiments.neutral ?? 0}
        </span>
        <span className="rounded bg-yellow-100 px-2 py-1 text-yellow-800">
          M: {typed.sentiments.mixed ?? 0}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  topicNode: TopicNode,
};

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const dagreGraph = new dagre.graphlib.Graph();

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "TB",
    ranksep: 100,
    nodesep: 50,
    marginx: 20,
    marginy: 20,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return {
    nodes: nodes.map((node) => {
      const pos = dagreGraph.node(node.id);
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

export default function TopicMapView({
  graph,
  selectedTopic,
  onSelectTopic,
}: Props) {
  const nodes: Node[] = graph.topics.map((topic) => ({
    id: topic.topic,
    type: "topicNode",
    position: { x: 0, y: 0 },
    data: {
      topic: topic.topic,
      count: topic.count,
      sentiments: topic.sentiments,
      isSelected: topic.topic === selectedTopic,
    },
  }));

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    type: "bezier",
    label: edge.weight > 1 ? String(edge.weight) : undefined,
  }));

  const layouted = getLayoutedElements(nodes, edges);

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    onSelectTopic(node.id);
  };

  return (
    <div className="h-[700px] w-full rounded-xl border bg-white">
      <ReactFlow
        nodes={layouted.nodes}
        edges={layouted.edges}
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