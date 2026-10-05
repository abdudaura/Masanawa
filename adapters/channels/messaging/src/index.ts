export type * from "./model.js";
export { createWhatsAppIngress, type WhatsAppIngressConfig } from "./whatsapp.js";
export { createTelegramIngress, type TelegramIngressConfig } from "./telegram.js";

export {
  createChannelActionReconciler,
  normalizeChannelActionBinding,
  type ChannelActionBinding,
  type ChannelActionConversationScope,
  type ChannelActionObservation,
  type ChannelActionSubjectScope,
  type DurableChannelActionStore,
  type ResolvedChannelAction,
} from "./action-reconciliation.js";

export {
  createChannelOutboundDispatcher,
  fingerprintChannelOutboundRequest,
  normalizeChannelOutboundRequest,
  resolveChannelOutboundAmbiguity,
  type ChannelOutboundContent,
  type ChannelOutboundConversation,
  type ChannelOutboundMediaResolver,
  type ChannelOutboundReceipt,
  type ChannelOutboundRecord,
  type ChannelOutboundRequest,
  type ChannelOutboundState,
  type ChannelProviderSender,
  type ChannelProviderSendResult,
  type DurableChannelOutbox,
} from "./outbound.js";

export {
  createChannelDeliveryReconciler,
  normalizeChannelDeliveryBinding,
  type ChannelDeliveryBinding,
  type ChannelDeliveryObservation,
  type DurableChannelDeliveryStore,
  type ResolvedChannelDelivery,
} from "./delivery-reconciliation.js";

export {
  createTelegramOutboundSender,
  type TelegramBotApiEdge,
  type TelegramOutboundSenderConfig,
} from "./telegram-outbound.js";

export {
  createWhatsAppOutboundSender,
  type WhatsAppCloudApiEdge,
  type WhatsAppOutboundSenderConfig,
} from "./whatsapp-outbound.js";
