import type { CharacterSessionScope } from "@masanawa/agents";
import {
  normalizeTeachingProgress,
  type TeachingProgress,
  type TeachingProgressRepository,
} from "@masanawa/skills";

const STUDY_PREFIX = "<masanawa_study>";
const STATE_TAG =
  /<masanawa_learning_state>([\s\S]{1,8000}?)<\/masanawa_learning_state>/u;

export const TEACHING_AGENT_SYSTEM_INSTRUCTIONS = Object.freeze([
  "Masanawa Core Teaching is activated only when the runtime marks a turn as Study.",
  "In Study mode, establish the learner's topic, level and goal naturally; never force a long questionnaire.",
  "Teach in detailed but manageable steps with concrete examples and worked solutions when useful.",
  "Use the language and register the learner is currently using. Language is dynamic and must not be stored as a fixed preference.",
  "Check understanding frequently. Give a small selectable or answerable exercise when useful, evaluate the answer, explain mistakes and try another explanation if needed.",
  "Distinguish practice from certification and state uncertainty for specialist/current claims when evidence is insufficient.",
  "At the end of EVERY Study-mode response append exactly one hidden machine block: <masanawa_learning_state>{\"topic\":\"...\",\"goal\":\"...\",\"level\":\"...\",\"checkpoint\":\"...\",\"nextStep\":\"...\",\"masteryNotes\":[\"...\"]}</masanawa_learning_state>.",
  "The hidden learning-state block is runtime metadata: never refer to it in user-facing prose.",
]);

export interface TeachingPreparation {
  readonly scope: CharacterSessionScope;
  readonly text: string;
  readonly previous: TeachingProgress | null;
}

export interface AgentTeachingAssistant {
  readonly systemInstructions: readonly string[];
  prepare(input: Readonly<{
    scope: CharacterSessionScope;
    text: string;
  }>): Promise<TeachingPreparation | null>;
  finish(input: Readonly<{
    preparation: TeachingPreparation;
    modelReply: string;
  }>): Promise<Readonly<{ reply: string; parts: readonly unknown[] }>>;
}

type TeachingPrepareInput =
  Parameters<AgentTeachingAssistant["prepare"]>[0];
type TeachingFinishInput =
  Parameters<AgentTeachingAssistant["finish"]>[0];

function clean(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized.slice(0, max);
}

function notes(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, values) => values.indexOf(item) === index)
      .slice(0, 24)
      .map((item) => item.slice(0, 300)),
  );
}

export function createAgentTeachingAssistant(input: Readonly<{
  repository: TeachingProgressRepository;
  now?: () => string;
}>): AgentTeachingAssistant {
  const now = input.now ?? (() => new Date().toISOString());

  return Object.freeze({
    systemInstructions: TEACHING_AGENT_SYSTEM_INSTRUCTIONS,

    async prepare(request: TeachingPrepareInput) {
      const raw = request.text.trim();
      if (!raw.startsWith(STUDY_PREFIX)) return null;
      const learnerText = raw.slice(STUDY_PREFIX.length).trim();
      if (!learnerText || learnerText.length > 32_000) {
        throw new RangeError("teaching.input_invalid");
      }
      const previous = await input.repository.read(request.scope);
      const continuity = previous
        ? JSON.stringify({
            topic: previous.topic,
            goal: previous.goal,
            level: previous.level,
            checkpoint: previous.checkpoint,
            nextStep: previous.nextStep,
            masteryNotes: previous.masteryNotes,
          })
        : "none";
      return Object.freeze({
        scope: request.scope,
        previous,
        text:
          `[MASANAWA STUDY MODE]\nPrivate learner progress: ${continuity}.\n` +
          `Current learner message: ${learnerText}\n` +
          "Continue naturally from progress when relevant. Do not quote the private progress block.",
      });
    },

    async finish(request: TeachingFinishInput) {
      const match = STATE_TAG.exec(request.modelReply);
      const visible = request.modelReply.replace(STATE_TAG, "").trim();
      if (!visible) throw new Error("teaching.empty_reply");
      if (!match?.[1]) {
        return Object.freeze({ reply: visible, parts: Object.freeze([]) });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        return Object.freeze({ reply: visible, parts: Object.freeze([]) });
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return Object.freeze({ reply: visible, parts: Object.freeze([]) });
      }
      const row = parsed as Record<string, unknown>;
      const previous = request.preparation.previous;
      const progress = normalizeTeachingProgress({
        ...request.preparation.scope,
        topic: clean(row.topic, previous?.topic ?? "Current lesson", 240),
        goal: clean(row.goal, previous?.goal ?? "Understand the current topic", 500),
        level: clean(row.level, previous?.level ?? "adaptive", 120),
        checkpoint: clean(
          row.checkpoint,
          previous?.checkpoint ?? "Lesson started",
          1000,
        ),
        nextStep: clean(
          row.nextStep,
          previous?.nextStep ?? "Continue the lesson",
          1000,
        ),
        masteryNotes: notes(row.masteryNotes),
        updatedAt: now() as never,
      });
      await input.repository.upsert(progress);
      return Object.freeze({
        reply: visible,
        parts: Object.freeze([
          Object.freeze({
            kind: "work",
            title: "Learning progress",
            body: progress.nextStep,
            document: Object.freeze({
              type: "teaching.progress",
              topic: progress.topic,
              checkpoint: progress.checkpoint,
              nextStep: progress.nextStep,
            }),
          }),
        ]),
      });
    },
  });
}
