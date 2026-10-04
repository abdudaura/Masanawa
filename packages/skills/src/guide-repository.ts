import type { SkillVersionId } from "@masanawa/contracts";
import type { SkillGuide } from "./guide.js";

export interface SkillGuideRepository {
  putGuide(input: SkillGuide): Promise<SkillGuide>;
  readGuide(skillVersionId: SkillVersionId): Promise<SkillGuide | null>;
  readGuides(skillVersionIds: readonly SkillVersionId[]): Promise<readonly SkillGuide[]>;
}
