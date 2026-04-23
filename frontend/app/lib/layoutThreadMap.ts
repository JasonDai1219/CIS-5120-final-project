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
    },
    children: nodes.map((node) => {
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