import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync('apps/mobile/android/app/src/main/AndroidManifest.xml', 'utf8');
const networkConfig = readFileSync('apps/mobile/android/app/src/main/res/xml/masanawa_network_security_config.xml', 'utf8');
const extractionRules = readFileSync('apps/mobile/android/app/src/main/res/xml/masanawa_data_extraction_rules.xml', 'utf8');
const privateDomains = [
  'root', 'file', 'database', 'sharedpref', 'external',
  'device_root', 'device_file', 'device_database', 'device_sharedpref',
];

describe('Android private-data release protection (R16)', () => {
  it('disables Android application backups for credentials and private chats', () => {
    expect(manifest).toMatch(/<application\b[^>]*android:allowBackup="false"/s);
    expect(manifest).toMatch(/<application\b[^>]*android:fullBackupContent="false"/s);
    expect(manifest).toMatch(/<application\b[^>]*android:dataExtractionRules="@xml\/masanawa_data_extraction_rules"/s);
  });

  it('excludes every Android 12+ private-data domain from cloud and D2D transfers', () => {
    expect(extractionRules).toMatch(/^<\?xml version="1\.0" encoding="utf-8"\?>/);
    expect(extractionRules).toContain('<data-extraction-rules>');
    for (const mode of ['cloud-backup', 'device-transfer']) {
      const section = extractionRules.match(new RegExp(`<${mode}>([\\s\\S]*?)<\\/${mode}>`))?.[1];
      expect(section, `missing ${mode} exclusions`).toBeDefined();
      const uncommented = section!.replace(/<!--[\s\S]*?-->/g, '');
      expect(uncommented).not.toMatch(/<include\b/);
      const excluded = [...uncommented.matchAll(/<exclude\s+domain="([^"]+)"\s+path="([^"]+)"\s*\/>/g)]
        .map((match) => [match[1], match[2]]);
      expect(excluded).toEqual(privateDomains.map((domain) => [domain, '.']));
    }
  });

  it('prohibits plaintext HTTP and refers to an explicit network security policy', () => {
    expect(manifest).toMatch(/<application\b[^>]*android:usesCleartextTraffic="false"/s);
    expect(manifest).toMatch(/<application\b[^>]*android:networkSecurityConfig="@xml\/masanawa_network_security_config"/s);
    expect(networkConfig).toMatch(/<base-config\s+cleartextTrafficPermitted="false">/);
    expect(networkConfig).toMatch(/<certificates\s+src="system"\s*\/>/);
    expect(networkConfig).not.toMatch(/<certificates\s+src="user"/);
    expect(networkConfig).not.toMatch(/cleartextTrafficPermitted="true"/);
  });

  it('keeps public Talk and Twin app links while preserving microphone permission', () => {
    expect(manifest).toContain('android:pathPrefix="/talk/"');
    expect(manifest).toContain('android:pathPrefix="/twin/"');
    expect(manifest).toContain('android.permission.RECORD_AUDIO');
  });
});
