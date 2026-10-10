import type { MissionInput, PostingSlot, SlotInput, StaffActor, WeeklyMission } from "./index.js";
export interface MissionScorecard {
  missionId: string;
  approved: number;
  published: number;
  failed: number;
  spentMinor: string;
  budgetMinor: string;
  /** Only real, externally measured engagement. Null until provided by canonical Feed metrics. */
  actualEngagement: number | null;
}
export interface MissionRepository {
  list(actor: StaffActor): Promise<readonly WeeklyMission[]>;
  get(actor: StaffActor, missionId: string): Promise<WeeklyMission | null>;
  create(actor: StaffActor, input: MissionInput): Promise<WeeklyMission>;
  setState(actor: StaffActor, missionId: string, state: "active"|"paused", revision: number): Promise<WeeklyMission>;
  slots(actor: StaffActor, missionId: string): Promise<readonly PostingSlot[]>;
  addSlot(actor: StaffActor, missionId: string, input: SlotInput): Promise<PostingSlot>;
  approveSlot(actor: StaffActor, slotId: string, revision: number): Promise<PostingSlot>;
  retrySlot(actor: StaffActor, slotId: string, revision: number): Promise<PostingSlot>;
  scorecard(actor: StaffActor, missionId: string): Promise<MissionScorecard>;
}
