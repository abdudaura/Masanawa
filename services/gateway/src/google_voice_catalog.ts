import { PROFESSIONAL_MASANA_CATALOG } from './platform_agent_bootstrap.js';

export interface CatalogVoice { readonly id: string; readonly display_name: string; readonly gender: string; readonly description?: string; readonly persona?: string; }
const legacy = new Set('Zephyr Puck Charon Kore Fenrir Leda Orus Aoede Callirrhoe Autonoe Enceladus Iapetus Umbriel Algieba Despina Erinome Algenib Rasalgethi Laomedeia Achernar Alnilam Schedar Gacrux Pulcherrima Achird Zubenelgenubi Vindemiatrix Sadachbia Sadaltager Sulafat'.toLowerCase().split(' '));
const females = new Set(['gwana','amina','fatima','zainab','safiya','ruqayya','maryam','hauwa','bilkisu','aisha','layla','grace','asha','mei']);
const cache = new Map<string, Promise<ReadonlyMap<string, string>>>();

export function assignMasanaVoices(voices: readonly CatalogVoice[]): ReadonlyMap<string,string> {
  const available = voices.filter(v =>
    typeof v.id === 'string' && v.id.trim().length > 0 &&
    typeof v.display_name === 'string' && v.display_name.trim().length > 0 &&
    typeof v.gender === 'string' && ['male','female'].includes(v.gender.toLowerCase()) &&
    !legacy.has(v.display_name.toLowerCase()))
    .sort((a,b)=>a.id.localeCompare(b.id));
  const used = new Set<string>();
  const assignments = new Map<string,string>();
  for (const agent of PROFESSIONAL_MASANA_CATALOG) {
    const gender = females.has(agent.key) ? 'female' : 'male';
    const anchor = agent.key === 'gwani' ? 'bodi' : agent.key === 'gwana' ? 'fola' : null;
    const terms = `${agent.roleLabel} ${agent.expertise.join(' ')} warm clear conversational`.toLowerCase().split(/\W+/).filter(x=>x.length>3);
    const score = (v: CatalogVoice) => terms.reduce((n,t)=>n + ( `${v.description ?? ''} ${v.persona ?? ''}`.toLowerCase().includes(t) ? 1 : 0),0);
    const candidates = available.filter(v=>!used.has(v.id) && v.gender.toLowerCase()===gender)
      .sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
    const voice = anchor ? candidates.find(v=>v.display_name.toLowerCase()===anchor) : candidates[0];
    if (!voice) {
      throw new Error(anchor
        ? `google.voice_catalog.anchor_missing_${anchor}`
        : `google.voice_catalog.insufficient_${gender}_voices`);
    }
    used.add(voice.id); assignments.set(agent.displayName,voice.id);
  }
  return assignments;
}

/** Read-only official catalog; no audio generation or provider spending. */
export function loadMasanaVoiceAssignments(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<ReadonlyMap<string,string>> {
  let pending = cache.get(apiKey);
  if (!pending) {
    pending = (async()=> {
      const voices: CatalogVoice[]=[]; let page: string|undefined;
      let pageCount = 0;
      const visited = new Set<string>();
      do {
        if (++pageCount > 30 || voices.length > 3000) {
          throw new Error('google.voice_catalog.pagination_limit');
        }
        if (page) {
          if (visited.has(page)) throw new Error('google.voice_catalog.repeated_cursor');
          visited.add(page);
        }
        const url = new URL('https://generativelanguage.googleapis.com/v1beta/voices');
        url.searchParams.set('type','prebuilt'); url.searchParams.set('page_size','1000');
        if(page) url.searchParams.set('page_token',page);
        const response=await fetchImpl(url,{headers:{'x-goog-api-key':apiKey},signal:AbortSignal.timeout(20000)});
        if(!response.ok) throw new Error(`google.voice_catalog.http_${response.status}`);
        const body=await response.json() as {voices?:CatalogVoice[];next_page_token?:string;nextPageToken?:string};
        if (!Array.isArray(body.voices) || body.voices.length > 1000) {
          throw new Error('google.voice_catalog.invalid_schema');
        }
        voices.push(...body.voices);
        const next=body.next_page_token??body.nextPageToken;
        if(next===page && next) throw new Error('google.voice_catalog.repeated_cursor');
        page=next;
      } while(page);
      return assignMasanaVoices(voices);
    })();
    cache.set(apiKey,pending);
    pending.catch(()=>cache.delete(apiKey));
  }
  return pending;
}
