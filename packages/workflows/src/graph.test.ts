import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  createWorkflow,
  createWorkflowGraph,
  createWorkflowVersion,
  workflowGraphLimits,
  workflowGraphSignature,
  type WorkflowEdge,
  type WorkflowGraph,
  type WorkflowNode,
} from "./index.js";

interface TestGraph {
  entryNodeKeys: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

function baseGraph(): TestGraph {
  return {
    entryNodeKeys: ["start"],
    nodes: [
      {
        key: "done",
        kind: "terminal",
        label: "Done",
        executor: null,
      },
      {
        key: "join_results",
        kind: "join",
        label: "Join results",
        executor: null,
      },
      {
        key: "route",
        kind: "decision",
        label: "Route",
        executor: {
          kind: "system",
          key: "bounded_route",
          version: "v1",
        },
      },
      {
        key: "branch_a",
        kind: "executor",
        label: "Branch A",
        executor: {
          kind: "skill",
          skillVersionId: createCanonicalId("skill-version"),
        },
      },
      {
        key: "branch_b",
        kind: "executor",
        label: "Branch B",
        executor: {
          kind: "tool",
          toolVersionId: createCanonicalId("tool-version"),
        },
      },
      {
        key: "start",
        kind: "executor",
        label: "Start",
        executor: {
          kind: "agent-strategy",
          key: "foreground",
          version: "v1",
        },
      },
    ],
    edges: [
      {
        from: "join_results",
        to: "done",
        condition: { kind: "always" },
      },
      {
        from: "branch_b",
        to: "join_results",
        condition: { kind: "always" },
      },
      {
        from: "route",
        to: "branch_b",
        condition: { kind: "label", label: "secondary" },
      },
      {
        from: "branch_a",
        to: "join_results",
        condition: { kind: "always" },
      },
      {
        from: "route",
        to: "branch_a",
        condition: { kind: "label", label: "primary" },
      },
      {
        from: "start",
        to: "route",
        condition: { kind: "always" },
      },
    ],
  };
}

describe("Workflow/WorkflowVersion graph contracts", () => {
  it("normalizes Workflow identity into an immutable snapshot", () => {
    const workflow = createWorkflow({
      tenantId: createCanonicalId("tenant"),
      workflowId: createCanonicalId("workflow"),
      name: "Research brief",
      description: "Produce a bounded research brief.",
      createdAt: toInstant(new Date("2026-10-04T18:00:00.000Z")),
    });

    expect(Object.isFrozen(workflow)).toBe(true);
    expect(workflow.name).toBe("Research brief");
  });

  it("supports explicit conditional fan-out and fan-in with deterministic ordering", () => {
    const graph = createWorkflowGraph(baseGraph());

    expect(graph.nodes.map((node) => node.key)).toEqual([
      "branch_a",
      "branch_b",
      "done",
      "join_results",
      "route",
      "start",
    ]);
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.nodes)).toBe(true);
    expect(Object.isFrozen(graph.edges)).toBe(true);
  });

  it("produces the same graph signature regardless of input node or edge order", () => {
    const first = baseGraph();
    const second: WorkflowGraph = {
      entryNodeKeys: [...first.entryNodeKeys].reverse(),
      nodes: [...first.nodes].reverse(),
      edges: [...first.edges].reverse(),
    };

    expect(workflowGraphSignature(first)).toBe(workflowGraphSignature(second));
    expect(workflowGraphSignature(first)).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it("pins an immutable WorkflowVersion to the normalized graph signature", () => {
    const graph = baseGraph();
    const version = createWorkflowVersion({
      tenantId: createCanonicalId("tenant"),
      workflowId: createCanonicalId("workflow"),
      workflowVersionId: createCanonicalId("workflow-version"),
      versionNumber: 1,
      graph,
      createdAt: toInstant(new Date("2026-10-04T18:00:00.000Z")),
    });

    const before = version.graphSignature;
    const mutableFirstNode = graph.nodes[0] as unknown as { label: string };
    mutableFirstNode.label = "Mutated outside";
    graph.edges.reverse();

    expect(version.graphSignature).toBe(before);
    expect(version.graph.nodes.find((node) => node.key === "done")?.label).toBe(
      "Done",
    );
    expect(Object.isFrozen(version.graph)).toBe(true);
  });

  it("rejects dangling edges and undeclared roots", () => {
    const dangling = baseGraph();
    dangling.edges = [
      ...dangling.edges,
      {
        from: "start",
        to: "missing",
        condition: { kind: "always" },
      },
    ];
    expect(() => createWorkflowGraph(dangling)).toThrow(/missing node/u);

    const hiddenRoot = baseGraph();
    hiddenRoot.nodes = [
      ...hiddenRoot.nodes,
      {
        key: "other_root",
        kind: "executor",
        label: "Other root",
        executor: {
          kind: "system",
          key: "other",
          version: "v1",
        },
      },
    ];
    hiddenRoot.edges = [
      ...hiddenRoot.edges,
      {
        from: "other_root",
        to: "done",
        condition: { kind: "always" },
      },
    ];
    expect(() => createWorkflowGraph(hiddenRoot)).toThrow(
      /root node other_root must be declared as an entry/u,
    );
  });

  it("rejects unreachable nodes and cycles", () => {
    const unreachable = baseGraph();
    unreachable.nodes = [
      ...unreachable.nodes,
      {
        key: "orphan",
        kind: "terminal",
        label: "Orphan",
        executor: null,
      },
    ];
    expect(() => createWorkflowGraph(unreachable)).toThrow(/unreachable nodes/u);

    const cycle = baseGraph();
    cycle.edges = [
      ...cycle.edges.filter((edge) => edge.from !== "join_results"),
      {
        from: "join_results",
        to: "start",
        condition: { kind: "always" },
      },
    ];
    expect(() => createWorkflowGraph(cycle)).toThrow(/must be acyclic/u);
  });

  it("rejects invalid decision, join, terminal and sink semantics", () => {
    const badDecision = baseGraph();
    badDecision.edges = badDecision.edges.filter(
      (edge) => !(edge.from === "route" && edge.to === "branch_b"),
    );
    expect(() => createWorkflowGraph(badDecision)).toThrow(
      /decision node route requires at least two outgoing edges/u,
    );

    const badJoin = baseGraph();
    badJoin.edges = badJoin.edges.filter(
      (edge) => !(edge.from === "branch_b" && edge.to === "join_results"),
    );
    expect(() => createWorkflowGraph(badJoin)).toThrow(
      /join node join_results requires at least two incoming edges/u,
    );

    const terminalOutgoing = baseGraph();
    terminalOutgoing.edges = [
      ...terminalOutgoing.edges,
      {
        from: "done",
        to: "branch_a",
        condition: { kind: "always" },
      },
    ];
    expect(() => createWorkflowGraph(terminalOutgoing)).toThrow(
      /terminal node done cannot have outgoing edges/u,
    );

    const implicitSink = baseGraph();
    implicitSink.edges = implicitSink.edges.filter(
      (edge) => edge.from !== "join_results",
    );
    expect(() => createWorkflowGraph(implicitSink)).toThrow(
      /non-terminal node join_results must have an outgoing edge/u,
    );
  });

  it("rejects duplicate nodes, duplicate edges and oversized graphs", () => {
    const duplicateNode = baseGraph();
    duplicateNode.nodes = [
      ...duplicateNode.nodes,
      duplicateNode.nodes[0]!,
    ];
    expect(() => createWorkflowGraph(duplicateNode)).toThrow(
      /duplicate node keys/u,
    );

    const duplicateEdge = baseGraph();
    duplicateEdge.edges = [
      ...duplicateEdge.edges,
      duplicateEdge.edges[0]!,
    ];
    expect(() => createWorkflowGraph(duplicateEdge)).toThrow(/duplicate edges/u);

    const huge: WorkflowGraph = {
      entryNodeKeys: ["n_0"],
      nodes: Array.from(
        { length: workflowGraphLimits.maxNodes + 1 },
        (_, index) => ({
          key: `n_${index}`,
          kind: "terminal" as const,
          label: `Node ${index}`,
          executor: null,
        }),
      ),
      edges: [],
    };
    expect(() => createWorkflowGraph(huge)).toThrow(/must contain between 1/u);
  });

  it("rejects direct self-subworkflow references and mismatched signatures", () => {
    const workflowVersionId = createCanonicalId("workflow-version");
    const graph: WorkflowGraph = {
      entryNodeKeys: ["call_self"],
      nodes: [
        {
          key: "call_self",
          kind: "executor",
          label: "Call self",
          executor: {
            kind: "subworkflow",
            workflowVersionId,
          },
        },
        {
          key: "done",
          kind: "terminal",
          label: "Done",
          executor: null,
        },
      ],
      edges: [
        {
          from: "call_self",
          to: "done",
          condition: { kind: "always" },
        },
      ],
    };

    expect(() =>
      createWorkflowVersion({
        tenantId: createCanonicalId("tenant"),
        workflowId: createCanonicalId("workflow"),
        workflowVersionId,
        versionNumber: 1,
        graph,
        createdAt: toInstant(new Date("2026-10-04T18:00:00.000Z")),
      }),
    ).toThrow(/cannot directly reference itself/u);

    const normal = baseGraph();
    expect(() =>
      createWorkflowVersion({
        tenantId: createCanonicalId("tenant"),
        workflowId: createCanonicalId("workflow"),
        workflowVersionId: createCanonicalId("workflow-version"),
        versionNumber: 1,
        graph: normal,
        graphSignature: "sha256:deadbeef",
        createdAt: toInstant(new Date("2026-10-04T18:00:00.000Z")),
      }),
    ).toThrow(/does not match normalized workflow graph/u);
  });
});
