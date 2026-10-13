/** Outbox-driven moderation handoff, not a second worker queue.
 * AF00 registers this handler with the existing events.outbox leased processor.
 * Never marks pending fan content publicly visible automatically.
 */
export type PendingCommentEvent={
 tenantId:string;postId:string;commentId:string;fanId:string;outboxEventId:string;
};
export interface CommentReviewPort {
 findPending(event:PendingCommentEvent):Promise<{body:string;state:string}|null>;
 submitReview(input:{tenantId:string;postId:string;commentId:string;reason:"new_fan_comment";idempotencyKey:string}):Promise<void>;
}
export function makeCommentReviewHandler(port:CommentReviewPort){
 return async(event:PendingCommentEvent):Promise<"ack"|"ignored">=>{
  if(!event.tenantId||!event.postId||!event.commentId||!event.outboxEventId)throw Error("invalid_feed_review_event");
  const comment=await port.findPending(event);
  if(!comment||comment.state!=="pending")return "ignored";
  // Durable review service must deduplicate the (tenant,comment) key; worker may replay.
  await port.submitReview({tenantId:event.tenantId,postId:event.postId,commentId:event.commentId,
   reason:"new_fan_comment",idempotencyKey:`feed-review:${event.tenantId}:${event.commentId}`});
  return "ack";
 };
}
