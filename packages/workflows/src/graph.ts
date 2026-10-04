import { createHash } from "node:crypto";
import {
  workflowGraphLimits,
  type Workflow,
  type WorkflowEdge,
  type WorkflowEdgeCondition,
  type WorkflowExecutorRef,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowVersion,
} from "./model.js";

const keyPattern = /^[a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)*$/u;
const versionPattern = /^v[1-9][0-9]*(?:\.[0-9]+){0,2}$/u;

function fail(message: string): never {
  throw new TypeError(message);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function bounded(
  value: unknown,
  name: string,
  maxLength: number,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength
  ) {
    fail(`${name} must be a non-empty string no longer than ${maxLength} characters`);
  }
  return value;
}

function key(value: unknown, name: string): string {
  const normalized = bounded(value, name, workflowGraphLimits.maxNodeKeyLength);
  if (!keyPattern.test(normalized)) {
    fail(`${name} must use a stable lowercase key format`);
  }
  return normalized;
}

function normalizeExecutor(
  executor: WorkflowExecutorRef | null,
  nodeKey: string,
): WorkflowExecutorRef | null {
  if (executor === null) {
    return null;
  }
  if (executor.kind === "skill") {
    return Object.freeze({
      kind: "skill",
      skillVersionId: executor.skillVersionId,
    });
  }
  if (executor.kind === "tool") {
    return Object.freeze({
      kind: "tool",
      toolVersionId: executor.toolVersionId,
    });
  }
  if (executor.kind === "subworkflow") {
    return Object.freeze({
      kind: "subworkflow",
      workflowVersionId: executor.workflowVersionId,
    });
  }

  const normalizedKey = bounded(
    executor.key,
    `nodes.${nodeKey}.executor.key`,
    workflowGraphLimits.maxExecutorKeyLength,
  );
  if (!keyPattern.test(normalizedKey)) {
    fail(`nodes.${nodeKey}.executor.key must use a stable lowercase key format`);
  }
  const version = bounded(
    executor.version,
    `nodes.${nodeKey}.executor.version`,
    workflowGraphLimits.maxExecutorVersionLength,
  );
  if (!versionPattern.test(version)) {
    fail(`nodes.${nodeKey}.executor.version must use vN, vN.N or vN.N.N format`);
  }
  return Object.freeze({
    kind: executor.kind,
    key: normalizedKey,
    version,
  });
}

function normalizeNode(node: WorkflowNode): WorkflowNode {
  const nodeKey = key(node.key, "node.key");
  const label = bounded(
    node.label,
    `nodes.${nodeKey}.label`,
    workflowGraphLimits.maxLabelLength,
  );

  const requiresExecutor = node.kind === "executor" || node.kind === "decision";
  if (requiresExecutor && node.executor === null) {
    fail(`nodes.${nodeKey} requires an executor reference`);
  }
  if (!requiresExecutor && node.executor !== null) {
    fail(`nodes.${nodeKey} cannot carry an executor reference`);
  }

  return Object.freeze({
    key: nodeKey,
    kind: node.kind,
    label,
    executor: normalizeExecutor(node.executor, nodeKey),
  });
}

function normalizeCondition(
  condition: WorkflowEdgeCondition,
  edgeName: string,
): WorkflowEdgeCondition {
  if (condition.kind === "always") {
    return Object.freeze({ kind: "always" });
  }
  return Object.freeze({
    kind: "label",
    label: key(
      condition.label,
      `${edgeName}.condition.label`,
    ),
  });
}

function edgeIdentity(edge: WorkflowEdge): string {
  return [
    edge.from,
    edge.to,
    edge.condition.kind,
    edge.condition.kind === "label" ? edge.condition.label : "",
  ].join("\u001f");
}

function normalizeEdge(edge: WorkflowEdge, index: number): WorkflowEdge {
  const from = key(edge.from, `edges[${index}].from`);
  const to = key(edge.to, `edges[${index}].to`);
  if (from === to) {
    fail(`edges[${index}] cannot self-loop`);
  }
  return Object.freeze({
    from,
    to,
    condition: normalizeCondition(edge.condition, `edges[${index}]`),
  });
}

function assertAcyclic(nodes: readonly WorkflowNode[], edges: readonly WorkflowEdge[]): void {
  const indegree = new Map(nodes.map((node) => [node.key, 0]));
  const outgoing = new Map(nodes.map((node) => [node.key, [] as string[]]));

  for (const edge of edges) {
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)!.push(edge.to);
  }

  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([nodeKey]) => nodeKey)
    .sort(compare);
  let visited = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    visited += 1;
    for (const next of outgoing.get(current)!.sort(compare)) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) {
        queue.push(next);
        queue.sort(compare);
      }
    }
  }

  if (visited !== nodes.length) {
    fail("workflow graph must be acyclic in WorkflowVersion v1");
  }
}

function assertReachable(
  entryNodeKeys: readonly string[],
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
): void {
  const outgoing = new Map(nodes.map((node) => [node.key, [] as string[]]));
  for (const edge of edges) {
    outgoing.get(edge.from)!.push(edge.to);
  }
  const seen = new Set<string>();
  const queue = [...entryNodeKeys];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of outgoing.get(current) ?? []) {
      queue.push(next);
    }
  }
  const unreachable = nodes
    .map((node) => node.key)
    .filter((nodeKey) => !seen.has(nodeKey))
    .sort(compare);
  if (unreachable.length > 0) {
    fail(`workflow graph contains unreachable nodes: ${unreachable.join(", ")}`);
  }
}

function assertNodeSemantics(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
): void {
  const outgoing = new Map(nodes.map((node) => [node.key, [] as WorkflowEdge[]]));
  const incoming = new Map(nodes.map((node) => [node.key, [] as WorkflowEdge[]]));
  for (const edge of edges) {
    outgoing.get(edge.from)!.push(edge);
    incoming.get(edge.to)!.push(edge);
  }

  for (const node of nodes) {
    const out = outgoing.get(node.key)!;
    const inc = incoming.get(node.key)!;

    if (node.kind === "terminal" && out.length !== 0) {
      fail(`terminal node ${node.key} cannot have outgoing edges`);
    }
    if (node.kind === "join" && inc.length < 2) {
      fail(`join node ${node.key} requires at least two incoming edges`);
    }

    if (node.kind === "decision") {
      if (out.length < 2) {
        fail(`decision node ${node.key} requires at least two outgoing edges`);
      }
      const labels = out.map((edge) =>
        edge.condition.kind === "label" ? edge.condition.label : null,
      );
      if (labels.some((label) => label === null)) {
        fail(`decision node ${node.key} requires labeled outgoing edges`);
      }
      if (new Set(labels).size !== labels.length) {
        fail(`decision node ${node.key} requires unique outgoing labels`);
      }
    } else if (out.some((edge) => edge.condition.kind === "label")) {
      fail(`only decision nodes may emit labeled edges (${node.key})`);
    }
  }
}

function canonicalGraphPayload(graph: WorkflowGraph): string {
  return JSON.stringify({
    entryNodeKeys: graph.entryNodeKeys,
    nodes: graph.nodes.map((node) => ({
      key: node.key,
      kind: node.kind,
      label: node.label,
      executor: node.executor,
    })),
    edges: graph.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      condition: edge.condition,
    })),
  });
}

export function createWorkflow(input: Workflow): Workflow {
  return Object.freeze({
    tenantId: input.tenantId,
    workflowId: input.workflowId,
    name: bounded(input.name, "workflow.name", workflowGraphLimits.maxNameLength),
    description:
      input.description.length === 0
        ? ""
        : bounded(
            input.description,
            "workflow.description",
            workflowGraphLimits.maxDescriptionLength,
          ),
    createdAt: input.createdAt,
  });
}

export function createWorkflowGraph(input: WorkflowGraph): WorkflowGraph {
  if (input.nodes.length === 0 || input.nodes.length > workflowGraphLimits.maxNodes) {
    fail(`workflow graph must contain between 1 and ${workflowGraphLimits.maxNodes} nodes`);
  }
  if (input.edges.length > workflowGraphLimits.maxEdges) {
    fail(`workflow graph exceeds ${workflowGraphLimits.maxEdges} edges`);
  }
  if (
    input.entryNodeKeys.length === 0 ||
    input.entryNodeKeys.length > workflowGraphLimits.maxEntryNodes
  ) {
    fail(`workflow graph must contain between 1 and ${workflowGraphLimits.maxEntryNodes} entry nodes`);
  }

  const nodes = input.nodes.map(normalizeNode).sort((a, b) => compare(a.key, b.key));
  const nodeKeys = nodes.map((node) => node.key);
  if (new Set(nodeKeys).size !== nodeKeys.length) {
    fail("workflow graph contains duplicate node keys");
  }
  const nodeSet = new Set(nodeKeys);

  const entryNodeKeys = [...new Set(input.entryNodeKeys.map((entry) => key(entry, "entryNodeKey")))]
    .sort(compare);
  for (const entry of entryNodeKeys) {
    if (!nodeSet.has(entry)) {
      fail(`workflow entry node does not exist: ${entry}`);
    }
  }

  const edges = input.edges
    .map(normalizeEdge)
    .sort((a, b) => compare(edgeIdentity(a), edgeIdentity(b)));
  const identities = edges.map(edgeIdentity);
  if (new Set(identities).size !== identities.length) {
    fail("workflow graph contains duplicate edges");
  }
  for (const edge of edges) {
    if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to)) {
      fail(`workflow edge references a missing node: ${edge.from} -> ${edge.to}`);
    }
  }

  assertAcyclic(nodes, edges);
  assertReachable(entryNodeKeys, nodes, edges);
  assertNodeSemantics(nodes, edges);

  return Object.freeze({
    entryNodeKeys: Object.freeze(entryNodeKeys),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
}

export function workflowGraphSignature(graph: WorkflowGraph): string {
  const normalized = createWorkflowGraph(graph);
  return `sha256:${createHash("sha256")
    .update(canonicalGraphPayload(normalized))
    .digest("hex")}`;
}

export function createWorkflowVersion(
  input: Omit<WorkflowVersion, "graphSignature"> & { readonly graphSignature?: string },
): WorkflowVersion {
  if (!Number.isSafeInteger(input.versionNumber) || input.versionNumber < 1) {
    fail("workflow versionNumber must be a positive safe integer");
  }
  const graph = createWorkflowGraph(input.graph);
  const graphSignature = workflowGraphSignature(graph);
  if (input.graphSignature && input.graphSignature !== graphSignature) {
    fail("supplied graphSignature does not match normalized workflow graph");
  }

  return Object.freeze({
    tenantId: input.tenantId,
    workflowId: input.workflowId,
    workflowVersionId: input.workflowVersionId,
    versionNumber: input.versionNumber,
    graph,
    graphSignature,
    createdAt: input.createdAt,
  });
}
