import { describe, expect, it } from "vitest";
import {validateMasanaProfile} from "./index.js";
const profile={handle:"Gwani",displayName:"Gwani",profession:"Technology",biography:"Practical technology",lifeStory:"A fictional helpful technologist",languages:["en","ha"],talents:["teaching"],goals:["help fans"],roomId:null,portraitMediaId:null,bannerMediaId:null};
describe("Masana profile admission",()=>{
  it("normalizes handle and freezes published DTO",()=>{
    const parsed=validateMasanaProfile(profile);expect(parsed.handle).toBe("gwani");expect(Object.isFrozen(parsed)).toBe(true);
  });
  it("rejects bidi and control injection",()=>expect(()=>validateMasanaProfile({...profile,displayName:"Fake\u202eeman"})).toThrow());
  it("rejects excessive fields",()=>expect(()=>validateMasanaProfile({...profile,lifeStory:"a".repeat(8001)})).toThrow());
  it("rejects non-allowlisted media references",()=>expect(()=>validateMasanaProfile({...profile,portraitMediaId:"https://example.com/a"})).toThrow());
});
