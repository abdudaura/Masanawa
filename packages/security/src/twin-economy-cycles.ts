export interface TwinEconomyTransferEdge {
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly amountCredits: number;
  readonly kind: "transfer" | "gift";
  readonly occurredAt: string;
}

export interface CircularValueDecision {
  readonly suspicious: boolean;
  readonly reason:
    | "none"
    | "direct-return"
    | "short-cycle"
    | "repeated-pair";
  readonly relatedUsers: readonly string[];
}

function recent(edges: readonly TwinEconomyTransferEdge[], now: string, minutes: number) {
  const cutoff = new Date(now).getTime() - minutes * 60 * 1000;
  return edges.filter((edge) => {
    const at = new Date(edge.occurredAt).getTime();
    return Number.isFinite(at) && at >= cutoff;
  });
}

export function detectCircularTwinEconomyValue(input: {
  readonly actorUserId: string;
  readonly recipientUserId: string;
  readonly recentEdges: readonly TwinEconomyTransferEdge[];
  readonly now: string;
}): CircularValueDecision {
  if (input.actorUserId === input.recipientUserId) {
    return {
      suspicious: true,
      reason: "direct-return",
      relatedUsers: [input.actorUserId],
    };
  }

  const edges = recent(input.recentEdges, input.now, 24 * 60);
  const reverse = edges.filter(
    (edge) =>
      edge.fromUserId === input.recipientUserId &&
      edge.toUserId === input.actorUserId,
  );
  if (reverse.length > 0) {
    return {
      suspicious: true,
      reason: "direct-return",
      relatedUsers: [input.actorUserId, input.recipientUserId],
    };
  }

  for (const first of edges) {
    if (first.fromUserId !== input.recipientUserId) continue;
    for (const second of edges) {
      if (
        second.fromUserId === first.toUserId &&
        second.toUserId === input.actorUserId
      ) {
        return {
          suspicious: true,
          reason: "short-cycle",
          relatedUsers: [
            input.actorUserId,
            input.recipientUserId,
            first.toUserId,
          ],
        };
      }
    }
  }

  const pairCount = edges.filter(
    (edge) =>
      edge.fromUserId === input.actorUserId &&
      edge.toUserId === input.recipientUserId,
  ).length;
  if (pairCount >= 10) {
    return {
      suspicious: true,
      reason: "repeated-pair",
      relatedUsers: [input.actorUserId, input.recipientUserId],
    };
  }

  return { suspicious: false, reason: "none", relatedUsers: [] };
}
