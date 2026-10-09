import type {AgentInferenceProvider} from "@masanawa/agents";
import {createCanonicalHumanAiGenerator} from "./inference_adapter.js";
import {createPostgresHumanAiSource, type HumanAiSql} from "./postgres_source.js";
import {createPostgresHumanAiBudget, type HumanAiBudgetSql} from "./postgres_budget.js";
import {createHumanAiAssistService, type HumanAiSender, type Principal} from "./service.js";

/** Inject existing authorities; never creates a second identity, DM store or provider. */
export function composeHumanAiAssist(input:{
  pool:HumanAiSql & HumanAiBudgetSql;
  authorizer:{authorize(input:{authorizationHeader:string|undefined}):Promise<Principal>};
  sender:HumanAiSender;
  inference:AgentInferenceProvider;
  reviewSecret:Buffer;
}) {
  return createHumanAiAssistService({
    identity:{authorize:header=>input.authorizer.authorize({authorizationHeader:header})},
    source:createPostgresHumanAiSource(input.pool),
    budget:createPostgresHumanAiBudget(input.pool),
    generator:createCanonicalHumanAiGenerator(input.inference),
    sender:input.sender,
    reviewSecret:input.reviewSecret,
  });
}
