import { describe, expect, it, vi } from "vitest";
import {
  AgentInferenceError,
  generateAgentInference,
  snapshotAgentInferenceRequest,
} from "./inference.js";
import type { AgentInferenceProvider, AgentInferenceRequest } from "./strategy.js";

const request = (): AgentInferenceRequest => ({
  systemInstructions: ["You are Amina."],
  input: { kind: "text", text: "Hello" },
});

describe("provider-neutral inference admission", () => {
  it("copies and freezes input before a provider wait and discards non-envelope fields", async () => {
    const original = {
      systemInstructions: ["Be helpful."],
      input: { kind: "text" as const, text: "Hello", privateField: "secret" },
      authority: "must not cross",
    };
    let captured: AgentInferenceRequest | undefined;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const pending = generateAgentInference({
      async generate(input) {
        captured = input;
        await waiting;
        return { text: " Hello back ", providerThread: "discard" };
      },
    }, original);
    original.systemInstructions[0] = "changed";
    original.input.text = "changed";
    release();
    expect(await pending).toEqual({ text: "Hello back" });
    expect(captured).toEqual({ systemInstructions: ["Be helpful."], input: { kind: "text", text: "Hello" } });
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured?.input)).toBe(true);
    expect(Object.isFrozen(captured?.systemInstructions)).toBe(true);
  });

  it.each([
    { systemInstructions: [], input: { kind: "text", text: "Hello" } },
    { systemInstructions: ["ok"], input: { kind: "text", text: " " } },
    { systemInstructions: ["ok"], input: { kind: "text", text: "x".repeat(32_001) } },
    { systemInstructions: ["ok"], input: { kind: "unknown" } },
    { systemInstructions: ["ok"], input: { kind: "media", caption: "", mimeType: "audio/mp4", dataBase64: "broken!" } },
    { systemInstructions: ["ok"], input: { kind: "media", caption: "", mimeType: "audio/mp4\nsecret", dataBase64: "YWJj" } },
  ])("rejects malformed input before invoking a provider (%#)", async (input) => {
    const generate = vi.fn();
    await expect(generateAgentInference({ generate }, input as AgentInferenceRequest)).rejects.toThrow(TypeError);
    expect(generate).not.toHaveBeenCalled();
  });

  it("preserves bounded media bytes without carrying runtime custody", () => {
    const snapshot = snapshotAgentInferenceRequest({
      systemInstructions: ["Listen."],
      input: { kind: "media", caption: "", mimeType: "audio/mp4", dataBase64: "YQ==" },
    });
    expect(snapshot.input).toEqual({ kind: "media", caption: "", mimeType: "audio/mp4", dataBase64: "YQ==" });
  });

  it.each([null, {}, { text: 7 }, { text: " " }, { text: "x".repeat(128_001) }])(
    "rejects malformed provider output (%#)",
    async (output) => {
      const provider = { async generate() { return output; } } as AgentInferenceProvider;
      await expect(generateAgentInference(provider, request())).rejects.toMatchObject({
        code: "inference.invalid_response", retryable: false,
      });
    },
  );

  it("redacts arbitrary vendor exceptions", async () => {
    const error = await generateAgentInference({
      async generate() { throw new Error("key=secret private user text"); },
    }, request()).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(AgentInferenceError);
    expect(JSON.stringify(error)).not.toContain("secret");
    expect(String(error)).not.toContain("private");
    expect(error).toMatchObject({ code: "inference.unavailable", retryable: true });
  });

  it("reconstructs typed failure metadata instead of forwarding arbitrary attached data", async () => {
    const failure = new AgentInferenceError("inference.rate_limited");
    Object.assign(failure, { details: { apiKey: "secret" }, message: "secret" });
    const error = await generateAgentInference({
      async generate() { throw failure; },
    }, request()).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "inference.rate_limited", retryable: true });
    expect(JSON.stringify(error)).not.toContain("secret");
  });
});

describe("bounded inference attempts", () => {
  it.each([
    {timeoutMs:0}, {timeoutMs:120001}, {timeoutMs:NaN},
    {maxOutputTokens:127}, {maxOutputTokens:8193}, {maxOutputCharacters:0},
  ])("rejects invalid limits before contacting inference: %j", async limits => {
    const provider={generate:vi.fn()};await expect(generateAgentInference(provider,request(),limits)).rejects.toThrow();
    expect(provider.generate).not.toHaveBeenCalled();
  });
  it("aborts a hung provider and rejects its later response", async () => {
    vi.useFakeTimers();
    try {
      let finish!:(value:{text:string})=>void;
      let signal!:AbortSignal;
      const pending=generateAgentInference({generate(_input,controls){
        signal=controls!.signal;return new Promise(resolve=>{finish=resolve;});
      }},request(),{timeoutMs:100});
      const failure=expect(pending).rejects.toMatchObject({code:"inference.deadline_exceeded"});
      await vi.advanceTimersByTimeAsync(100);await failure;
      expect(signal.aborted).toBe(true);finish({text:"Late response must not complete the turn"});
      await Promise.resolve();expect(vi.getTimerCount()).toBe(0);
    } finally {vi.useRealTimers();}
  });
  it("keeps deadline errors safe when a vendor rejects on abort", async () => {
    vi.useFakeTimers();
    try {
      const pending=generateAgentInference({generate(_input,controls){return new Promise((_resolve,reject)=>{
        controls!.signal.addEventListener("abort",()=>reject(new Error("private vendor secret")),{once:true});
      });}},request(),{timeoutMs:100});
      const caught=pending.catch(error=>error);await vi.advanceTimersByTimeAsync(100);
      const error=await caught;expect(error.code).toBe("inference.deadline_exceeded");
      expect(JSON.stringify(error)).not.toContain("secret");
    } finally {vi.useRealTimers();}
  });
  it("cleans up the timer after early failures", async () => {
    vi.useFakeTimers();
    try {
      await expect(generateAgentInference({async generate(){throw new Error("vendor");}},request())).rejects.toThrow();
      expect(vi.getTimerCount()).toBe(0);
    } finally {vi.useRealTimers();}
  });
  it("rejects output beyond the configured character bound", async () => {
    await expect(generateAgentInference({async generate(){return {text:"oversized"};}},request(),
      {maxOutputCharacters:4})).rejects.toMatchObject({code:"inference.output_limit_exceeded",retryable:false});
  });
  it("snapshots limits separately from the inference envelope", async () => {
    const limits={maxOutputTokens:512};let finish!:(value:{text:string})=>void;
    const pending=generateAgentInference({generate(input,controls){
      expect(Object.keys(input).sort()).toEqual(["input","systemInstructions"]);
      expect(controls?.maxOutputTokens).toBe(512);expect(Object.isFrozen(controls)).toBe(true);
      return new Promise(resolve=>{finish=resolve;});}},request(),limits);
    limits.maxOutputTokens=8192;finish({text:"Admitted"});expect(await pending).toEqual({text:"Admitted"});
  });
  it("rejects a response beyond the monotonic deadline even before the timer fires",async()=>{
    const clock=vi.spyOn(performance,"now").mockReturnValueOnce(0).mockReturnValueOnce(101);
    try {await expect(generateAgentInference({async generate(){return {text:"Late"};}},request(),{timeoutMs:100}))
      .rejects.toMatchObject({code:"inference.deadline_exceeded"});}finally{clock.mockRestore();}
  });
});
