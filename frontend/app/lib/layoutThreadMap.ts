import ELK from "elkjs/lib/elk.bundled.js";
import type { Edge } from "@xyflow/react";
import type { BaseGraphNode } from "../components/UserThreadMapView";

const elk = new ELK();

function getNodeSize(node: BaseGraphNode) {
  let width = 320;
  let height = 180;

  if (node.isRoot) {
    width = 360;
    height = 200;
  }

  if (node.sentiment === "critical" || node.sentiment === "mixed") {
    width += 20;
    height += 10;
  }

  if (node.hasChildren) {
    width += 10;
  }

  return { width, height };
}

export async function layoutThreadMap(
  nodes: BaseGraphNode[],
  edges: Edge[]
): Promise<BaseGraphNode[]> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  // 计算每个节点的深度（0 = root）
  function getDepth(node: BaseGraphNode): number {
    let depth = 0;
    let current: BaseGraphNode | undefined = node;
    while (current && !current.isRoot) {
      depth++;
      const parent = nodeById.get(current.parentId ?? "");
      if (!parent) break;
      current = parent;
    }
    return depth;
  }

  // 找到每个节点的 root 时间戳
  function getRootTimestamp(node: BaseGraphNode): number {
    let current: BaseGraphNode | undefined = node;
    while (current && !current.isRoot) {
      const parent = nodeById.get(current.parentId ?? "");
      if (!parent) break;
      current = parent;
    }
    return current ? new Date(current.timestamp).getTime() : new Date(node.timestamp).getTime();
  }

  // 按照：深度（root 优先） -> root 时间戳 -> 自身时间戳 排序节点
  const sortedNodes = [...nodes].sort((a, b) => {
    const aDepth = getDepth(a);
    const bDepth = getDepth(b);
    
    // 先按深度排序（depth 小的在前，即 root 在前）
    if (aDepth !== bDepth) {
      return aDepth - bDepth;
    }

    // 同一深度的节点，按 root 时间戳排序
    const aRootTime = getRootTimestamp(a);
    const bRootTime = getRootTimestamp(b);
    if (aRootTime !== bRootTime) {
      return aRootTime - bRootTime;
    }

    // 同一 root 的节点按自身时间戳排序
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.spacing.nodeNode": "50",
      "elk.layered.spacing.nodeNodeBetweenLayers": "90",
      "elk.layered.spacing.edgeNodeBetweenLayers": "50",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: sortedNodes.map((node) => {
      const { width, height } = getNodeSize(node);
      return {
        id: node.id,
        width,
        height,
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layouted = await elk.layout(elkGraph);

  const positionById = new Map(
    (layouted.children ?? []).map((child) => [
      child.id,
      { x: child.x ?? 0, y: child.y ?? 0 },
    ])
  );

  return nodes.map((node) => ({
    ...node,
    position: positionById.get(node.id) ?? node.position,
  }));
}