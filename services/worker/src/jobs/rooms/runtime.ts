import type { TeacherQueue } from "@masanawa/rooms";
import { createRoomTeacherWorker, type RoomAnswerModel } from "./teacher.js";

/** Direct AI question answers on the canonical Rooms outbox.
 * Runs automatically whenever the worker and Gemini credentials are ready.
 * No staff review, arbitrary activation flag or second queue. */
export function createRoomTeacherRuntime(input: {
  readonly queue: TeacherQueue;
  readonly model: RoomAnswerModel;
  readonly workerId: string;
  readonly enabled: () => boolean;
  readonly intervalMs?: number;
  readonly onError?: (error: unknown) => void;
}) {
  const delay = input.intervalMs ?? 2500;
  if (!Number.isSafeInteger(delay) || delay < 1000 || delay > 60000)
    throw new RangeError("rooms_worker_interval_invalid");
  const worker=createRoomTeacherWorker(input.queue,input.model,input.workerId,input.enabled);
  let current: ReturnType<typeof worker.tick> | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  let stopped=false;

  async function tick():Promise<"disabled"|"busy"|"idle"|"processed"|"retry">{
    if(stopped || !input.enabled())return "disabled";
    if(current)return "busy";
    const work=worker.tick();
    current=work;
    try{return await work;}
    finally{if(current===work)current=undefined;}
  }
  return Object.freeze({
    tick,
    start():void{
      if(interval||stopped||!input.enabled())return;
      interval=setInterval(()=>{void tick().catch(error=>input.onError?.(error));},delay);
      interval.unref?.();
    },
    async stop():Promise<void>{
      stopped=true;
      if(interval)clearInterval(interval);
      interval=undefined;
      await current?.catch(()=>undefined);
    },
  });
}
