import {describe,it,expect} from 'vitest';
import {parseRehearsalInput,parseRehearsalPreview} from './rehearsal.js';
const input={revision:2,mode:'post',prompt:'Explain sorting',idempotencyKey:'request_234'};
describe('A04 strictly bounded rehearsal contract',()=>{
 it('admits a bounded dry-run',()=>expect(parseRehearsalInput(input)).toMatchObject(input));
 it('denies destructive modes and malformed keys',()=>{
  for(const mode of ['publish','finance','live','call_user'])expect(()=>parseRehearsalInput({...input,mode})).toThrow();
  expect(()=>parseRehearsalInput({...input,idempotencyKey:'bad'})).toThrow();
 });
 it('bounds input and preview outputs',()=>{
  expect(()=>parseRehearsalInput({...input,prompt:'x'.repeat(2001)})).toThrow();
  expect(()=>parseRehearsalPreview({summary:'ok',previewText:'x'.repeat(4001)})).toThrow();
  expect(parseRehearsalPreview({summary:'ok',previewText:'A sample'}).previewText).toBe('A sample');
 });
});