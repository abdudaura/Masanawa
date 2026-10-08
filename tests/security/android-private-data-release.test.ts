import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync('apps/mobile/android/app/src/main/AndroidManifest.xml', 'utf8');
const networkConfig = readFileSync('apps/mobile/android/app/src/main/res/xml/masanawa_network_security_config.xml', 'utf8');

describe('Android private-data release protection (R16)', () => {
  it('disables Android application backups for credentials and private chats', () => {
    expect(manifest).toMatch(/<application\b[^>]*android:allowBackup="false"/s);
    expect(manifest).toMatch(/<application\b[^>]*android:fullBackupContent="false"/s);
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
