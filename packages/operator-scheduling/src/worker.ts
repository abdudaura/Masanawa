import { isQuiet, publicNotification, timezoneParts } from "./domain.js";
import type { Occurrence, ScheduleRepository } from "./repository.js";

export interface ScheduleNotificationSender {
  send(input: Readonly<{
    tenantId: string;
    userId: string;
    title: string;
    body: string;
    dedupeKey: string;
    data: Readonly<Record<string,string>>;
  }>): Promise<Readonly<{attempted: number; delivered: number}>>;
}
export interface ScheduleWorker {
  tick(input?: Readonly<{now?: Date;limit?: number}>): Promise<Readonly<{
    claimed: number; delivered: number; noDevice: number;
    skipped: number; uncertain: number;
  }>>;
}
export function createScheduleWorker(input: Readonly<{
  repository: ScheduleRepository;
  sender?: ScheduleNotificationSender;
}>): ScheduleWorker {
  return Object.freeze({
    async tick(options={}) {
      // Disabled-by-default until R14 dispatcher and F11 worker lifecycle are wired.
      if (!input.sender) throw new Error("schedule.push_unconfigured");
      const now = options.now ?? new Date();
      const limit = options.limit ?? 20;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
        throw new RangeError("schedule.limit_invalid");
      await input.repository.expireUnknown(now);
      // Reclaim only unstarted work; an attempted push is never auto-retried.
      const expired = await input.repository.reclaimExpired(now,limit);
      const room = limit - expired.length;
      const available = room > 0 ? await input.repository.claimDue(now,room) : [];
      const occurrences = [...expired,...available].slice(0,limit);
      let delivered=0, noDevice=0, skipped=0, uncertain=0;
      for (const item of occurrences) {
        const schedule = await input.repository.readForDispatch(item);
        if (!schedule || Date.parse(item.scheduledFor) < now.getTime()-12*60*60*1000 ||
            isQuiet(timezoneParts(now.getTime(),schedule.timezone).localTime,
              schedule.quietStart,schedule.quietEnd)) {
          await input.repository.markSkipped(item,now);
          skipped++;
          continue;
        }
        // Durable send fence is committed BEFORE contacting provider. A crash or
        // partial FCM fan-out is UNCERTAIN; retrying could alert multiple times.
        if (!await input.repository.markStarted(item,now)) { skipped++; continue; }
        const message = publicNotification(schedule.kind);
        let state: "sent" | "no_device" | "uncertain" = "uncertain";
        try {
          const result = await input.sender.send({
            tenantId:item.tenantId,userId:item.userId,
            title:message.title,body:message.body,
            dedupeKey:`u25:${item.occurrenceId}`,
            data:{type:"operator_reminder",scheduleId:item.scheduleId},
          });
          if (result.attempted === 0) state="no_device";
          else if (result.delivered === result.attempted) state="sent";
          // Partial fan-out remains uncertain; do not retry blindly.
        } catch { state="uncertain"; }
        await input.repository.finish(item,state,new Date());
        if (state === "sent") delivered++;
        else if (state === "no_device") noDevice++;
        else uncertain++;
      }
      return Object.freeze({claimed:occurrences.length,delivered,noDevice,skipped,uncertain});
    },
  });
}
