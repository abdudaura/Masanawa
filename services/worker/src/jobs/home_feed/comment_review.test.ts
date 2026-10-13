import {describe,it,expect,vi} from "vitest";
import {makeCommentReviewHandler} from "./comment_review.js";
const event={tenantId:"tenant",postId:"post",commentId:"comment",fanId:"fan",outboxEventId:"evt"};
describe("new fan comment outbox review",()=>{
 it("queues only pending comments using stable dedupe key",async()=>{
  const submitReview=vi.fn(async()=>{});
  const handler=makeCommentReviewHandler({findPending:async()=>({state:"pending",body:"question"}),submitReview});
  expect(await handler(event)).toBe("ack");
  expect(submitReview).toHaveBeenCalledWith(expect.objectContaining({idempotencyKey:"feed-review:tenant:comment"}));
 });
 it("never publishes or creates another queue on replay/removed comment",async()=>{
  const submitReview=vi.fn();const handler=makeCommentReviewHandler({findPending:async()=>({state:"removed",body:""}),submitReview});
  expect(await handler(event)).toBe("ignored");expect(submitReview).not.toHaveBeenCalled();
 });
});
