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
