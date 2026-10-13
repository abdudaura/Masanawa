import { RoomError, type PlaySubscriptionVerifier, type VerifiedPlaySubscription } from "@masanawa/rooms";

/** Google Play Developer API access token is issued by the existing server credential authority only. */
export interface GooglePlayVerifierOptions {
 readonly packageName:string;
 readonly getAccessToken:()=>Promise<string>;
 readonly http?:typeof fetch;
}
type JsonObject=Record<string,unknown>;
const object=(value:unknown):JsonObject=>
 value!==null&&typeof value==="object"&&!Array.isArray(value)?value as JsonObject:{};
const str=(value:unknown):string=>typeof value==="string"?value:"";
function lineItems(value:unknown):JsonObject[]{
 return Array.isArray(value)?value.map(object):[];
}
function cleanToken(token:string):string{
 if(!/^[A-Za-z0-9._:-]{20,2048}$/u.test(token))throw new RoomError(422,"invalid_purchase_token");
 return encodeURIComponent(token);
}
export function createGooglePlaySubscriptionVerifier(options:GooglePlayVerifierOptions):PlaySubscriptionVerifier {
 const pkg=options.packageName.trim();
 if(!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){1,7}$/u.test(pkg))
  throw new TypeError("invalid_google_play_package");
 const http=options.http??fetch;
 const base="https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"+encodeURIComponent(pkg)+"/purchases/";
 async function call(url:string,method:"GET"|"POST"):Promise<JsonObject>{
  const token=await options.getAccessToken();
  if(!token||!/^[A-Za-z0-9._-]{15,4096}$/u.test(token))throw new RoomError(503,"play_auth_unavailable");
  const response=await http(url,{method,headers:{
   "Authorization":"Bearer "+token,
   "Accept":"application/json",
   ...(method==="POST"?{"Content-Type":"application/json"}:{})
  },...(method==="POST"?{body:"{}"}:{}),redirect:"error",signal:AbortSignal.timeout(10000)});
  if(!response.ok){
   // Do not leak response bodies, bearer credentials or raw purchase tokens.
   throw new RoomError(response.status===404?409:503,response.status===404?"play_purchase_not_found":"play_verification_unavailable");
  }
  return method==="POST"?{}:object(await response.json());
 }
 return {
  async verify(token:string):Promise<VerifiedPlaySubscription>{
   const result=await call(base+"subscriptionsv2/tokens/"+cleanToken(token),"GET");
   const items=lineItems(result.lineItems);
   if(items.length!==1)throw new RoomError(409,"play_unsupported_multiple_items");
   const item=items[0]!;
   const productId=str(item.productId);
   const expiry=str(item.expiryTime);
   const account=object(result.externalAccountIdentifiers);
   if(!productId||!Number.isFinite(Date.parse(expiry)))
    throw new RoomError(503,"play_receipt_malformed");
   return {
    packageName:pkg,
    storeProductId:productId,
    subscriptionState:str(result.subscriptionState),
    periodEnd:expiry,
    orderId:result.latestOrderId===undefined?null:str(result.latestOrderId),
    acknowledged:result.acknowledgementState==="ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    obfuscatedAccountId:account.obfuscatedExternalAccountId===undefined?null:str(account.obfuscatedExternalAccountId)
   };
  },
  async acknowledge(token:string,subscriptionId:string):Promise<void>{
   if(!/^[a-z][a-z0-9._]{2,179}$/u.test(subscriptionId))throw new RoomError(422,"invalid_store_product");
   await call(base+"subscriptions/"+encodeURIComponent(subscriptionId)+"/tokens/"+cleanToken(token)+":acknowledge","POST");
  }
 };
}
