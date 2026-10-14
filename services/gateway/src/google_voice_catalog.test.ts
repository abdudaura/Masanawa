import { describe, expect, it, vi } from 'vitest';
import { PROFESSIONAL_MASANA_CATALOG } from './platform_agent_bootstrap.js';
import {
  assignMasanaVoices, loadMasanaVoiceAssignments,
  type CatalogVoice,
} from './google_voice_catalog.js';

function rosterVoices(): CatalogVoice[] {
  return PROFESSIONAL_MASANA_CATALOG.map((seed, index) => ({
    id: `voice-resource-${index}`,
    display_name: index === 0 ? 'Bodi' : index === 1 ? 'Fola' : `Role Voice ${index}`,
    gender: seed.voiceName === 'Sulafat' ? 'female' : 'male',
    description: seed.roleLabel,
  }));
}

describe('official Google extended catalog voice assignment', () => {
  it('uses real provider IDs and chooses one distinct gender-matched voice for each of 26 profiles', () => {
    const voices = rosterVoices();
    const map = assignMasanaVoices(voices);
    expect(map.size).toBe(PROFESSIONAL_MASANA_CATALOG.length);
    expect(new Set(map.values()).size).toBe(map.size);
    expect(map.get('Mallam Gwani Bodi')).toBe('voice-resource-0');
    expect(map.get('Malamah Gwana Sulafat')).toBe('voice-resource-1');
    expect([...map.values()].every(id => id.startsWith('voice-resource-'))).toBe(true);
  });

  it('rejects incomplete catalogs rather than silently reusing old studio voices', () => {
    expect(() => assignMasanaVoices([
      { id: 'legacy', display_name: 'Zephyr', gender: 'female' },
      ...rosterVoices().filter(v => v.display_name !== 'Fola'),
    ])).toThrow('google.voice_catalog.anchor_missing_fola');
    expect(() => assignMasanaVoices(rosterVoices().filter(v => v.display_name !== 'Bodi')))
      .toThrow('google.voice_catalog.anchor_missing_bodi');
  });

  it('rejects invalid or incomplete gender metadata without guessing', () => {
    const invalid = rosterVoices().map((voice, index) =>
      index === 1 ? { ...voice, gender: '' } : voice);
    expect(() => assignMasanaVoices(invalid))
      .toThrow('google.voice_catalog.anchor_missing_fola');
  });

  it('pages through the authenticated catalog and passes the requested provider IDs', async () => {
    const all = rosterVoices();
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const parsed = new URL(String(url));
      expect(init?.headers).toMatchObject({ 'x-goog-api-key': 'catalog-test-paging' });
      expect(parsed.searchParams.get('type')).toBe('prebuilt');
      const next = parsed.searchParams.get('page_token');
      return new Response(JSON.stringify(next === 'second'
        ? { voices: all.slice(13) }
        : { voices: all.slice(0, 13), next_page_token: 'second' }), { status: 200 });
    });
    const result = await loadMasanaVoiceAssignments('catalog-test-paging', fetchImpl as typeof fetch);
    expect(result.size).toBe(26);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects a repeated provider pagination cursor', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      voices: rosterVoices().slice(0, 4), next_page_token: 'repeat',
    }), { status: 200 }));
    await expect(loadMasanaVoiceAssignments('catalog-test-repeated', fetchImpl as typeof fetch))
      .rejects.toThrow('google.voice_catalog.repeated_cursor');
  });
});
