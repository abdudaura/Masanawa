import type {
  AgentInferenceProvider,
  AgentStrategy,
} from "@masanawa/agents";
import { privatePersonaRoleInstructions } from "./production_persona_role.js";
import {
  evaluateSkillDiscovery,
  evaluateSkillEligibility,
  restoreSkillRegistry,
  type SkillGuideRepository,
  type SkillRepository,
} from "@masanawa/skills";

export function createProductionAgentStrategy(input: {
  readonly inference: AgentInferenceProvider;
  readonly skills: SkillRepository;
  readonly guides: SkillGuideRepository;
  readonly systemInstructions?: readonly string[];
}): AgentStrategy {
  const strategy: AgentStrategy = {
    async execute(request) {
      const surface = request.surface ?? "mobile";
      const representation = request.representation ?? "platform-agent";
      const surfaceInstructions =
        surface === "whatsapp"
          ? [
              "You are serving this user inside WhatsApp, not inside the Masanawa mobile app.",
              "Keep replies compact, conversational, and easy to follow in chat. Prefer one question at a time.",
              "Never tell the user to tap app tabs, cards, sheets, or buttons that do not exist in WhatsApp.",
              "Complete chat-capable Masanawa services directly here when runtime evidence allows: billing, wallet guidance, crypto, Teaching, memory-backed conversation, and free public Twin text chat.",
              "Do not claim paid Twin voice, real-owner access, Twin creation/customization, visual Explore browsing, gifting, Credit transfer, or any other action is completed in this channel unless the runtime actually provides the action/evidence for this turn.",
              "When a feature truly requires the Masanawa app, say so plainly and offer the smallest possible handoff instead of pretending the UI exists here.",
              "If useful, present short numbered choices that can be answered with a number or plain words.",
              "Treat voice notes as normal user messages; do not ask the user to retype information already understood from audio.",
            ]
          : surface === "telegram"
            ? [
                "You are serving this user inside Telegram, not inside the Masanawa mobile app.",
                "Keep replies compact and conversational. Prefer one question at a time and short selectable choices.",
                "Never tell the user to tap app-only tabs, cards, sheets, or buttons.",
                "Complete chat-capable Masanawa services directly here when runtime evidence allows: billing, wallet guidance, crypto, Teaching, memory-backed conversation, and free public Twin text chat.",
                "Do not claim paid Twin voice, real-owner access, Twin creation/customization, visual Explore browsing, gifting, Credit transfer, or any other action is completed in this channel unless the runtime actually provides the action/evidence for this turn.",
                "When a feature truly requires the Masanawa app, say so plainly and offer the smallest possible handoff.",
                "Telegram reply keyboards or buttons may be supplied by the transport; do not claim a button exists unless the runtime actually presents one.",
                "Treat voice notes and supported media as normal user messages; do not ask the user to repeat information already understood.",
              ]
            : [
                "You are serving this user inside the Masanawa mobile app and may refer to app UI only when it actually exists in the current runtime.",
              ];
      const representationInstructions =
        representation === "public-twin"
          ? [
              "You are currently representing a public AI Twin, not the real human owner.",
              "Never imply the real owner is present in this conversation.",
              "Public Twin text conversation is free. Do not invent a text-chat charge or require paid voice admission for ordinary text.",
            ]
          : [
              "You are currently acting as a Masanawa platform/support Agent.",
            ];

      const instructions = [
        ...privatePersonaRoleInstructions(request.presentation),
        ...surfaceInstructions,
        ...representationInstructions,
        "Never claim a Skill, Tool, file, call, live-data result, memory write, payment, or external side effect unless the runtime actually provides evidence for it.",
        ...(input.systemInstructions ?? []),
      ];

      const userText =
        request.input.kind === "text"
          ? request.input.text
          : request.input.caption;

      if (userText.trim() && request.skillVersionIds.length > 0) {
        const snapshot = await input.skills.readSnapshot();
        const registry = restoreSkillRegistry(snapshot);
        const guides = await input.guides.readGuides(request.skillVersionIds);

        const selected = guides
          .map((guide) => {
            const eligibility = evaluateSkillEligibility(
              registry,
              guide.skillVersionId,
            );
            const skill = registry.getVersion(guide.skillVersionId);
            const discovery = evaluateSkillDiscovery(guide, userText);
            return { guide, skill, eligibility, discovery };
          })
          .filter(
            ({ skill, eligibility, discovery }) =>
              skill?.billingMode === "none" &&
              eligibility.eligible &&
              eligibility.advertisable &&
              discovery.eligible,
          )
          .sort((left, right) => {
            if (right.discovery.score !== left.discovery.score) {
              return right.discovery.score - left.discovery.score;
            }
            return right.guide.discovery.priority - left.guide.discovery.priority;
          })
          .slice(0, 8);

        for (const { guide } of selected) {
          instructions.push(
            `Selected Skill ${guide.skillVersionId}:`,
            guide.instructions,
          );
        }
      }

      const result = await input.inference.generate(
        {
          systemInstructions: Object.freeze(instructions),
          input: request.input,
        },
        {
          ...(request.signal ? { signal: request.signal } : {}),
          maxOutputTokens: 4096,
          ...(request.onTextDelta ? { onTextDelta: request.onTextDelta } : {}),
        },
      );
      const reply = result.text.trim();
      if (!reply) throw new Error("Production inference returned no text");
      return Object.freeze({
        reply,
        parts: Object.freeze([]),
      });
    },
  };
  return Object.freeze(strategy);
}

