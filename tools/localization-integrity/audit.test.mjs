import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditCatalogs, auditDirectory, SUPPORTED } from './audit.mjs';

function fixture() {
  const en = {
    '@@locale': 'en',
    appTitle: 'Masanawa',
    wallets: '{count, plural, =0{No wallets} one{One wallet} other{{count} wallets}}',
    '@wallets': {placeholders: {count: {type: 'int'}}},
    amount: '{amount} {currency}',
    '@amount': {placeholders: {amount: {type: 'String'}, currency: {type: 'String'}}},
    activity: '{gender, select, male{He} female{She} other{They}} sent {count} notes.',
    '@activity': {placeholders: {gender: {type: 'String'}, count: {type: 'int'}}},
  };
  return Object.fromEntries(SUPPORTED.map(locale => [locale, {...structuredClone(en), '@@locale':locale}]));
}
const errors = catalogs => auditCatalogs(catalogs).errors.join('\n');

test('complete known-structure locale catalog passes', () => assert.equal(errors(fixture()), ''));
test('missing locale or missing key rejects', () => {
  const c = fixture(); delete c.fr; delete c.es.amount;
  assert.match(errors(c), /fr:@@locale: missing catalog/);
  assert.match(errors(c), /es:amount: missing translation key/);
});
test('new key absent from sibling translations rejects', () => {
  const c = fixture(); c.en.newPayment = 'Pay safely';
  assert.match(errors(c), /ar:newPayment: missing translation key/);
});
test('new foreign locale key rejects', () => {
  const c=fixture(); c.ar.unreviewed = 'oops';
  assert.match(errors(c), /ar:unreviewed: unexpected translation key/);
});
test('financial placeholders cannot change identity or vanish', () => {
  const c=fixture(); c.fr.amount='{amount} {token}';
  assert.match(errors(c), /fr:amount: placeholder set .* differs from en/);
});
test('plural without other is rejected', () => {
  const c=fixture(); c.ha.wallets='{count, plural, one{Wallet}}';
  assert.match(errors(c), /ha:wallets: ICU syntax: .* requires an other option/);
});
test('plural with missing closing brace rejects', () => {
  const c=fixture(); c.pt.wallets='{count, plural, other{{count} carteiras}';
  assert.match(errors(c), /pt:wallets: ICU syntax: unclosed/);
});
test('nested select and plural preserve exact parameter set', () => {
  const c=fixture(); c.ar.activity='{gender, select, male{{count} msgs} female{{count} msgs} other{{count} msgs}}';
  assert.equal(errors(c), '');
});
test('unintroduced interpolation fails even if numeric fields remain', () => {
  const c=fixture(); c.ar.amount='{amount} {currency} {recipient}';
  assert.match(errors(c), /ar:amount: placeholder set/);
});
test('orphan placeholder metadata is not silently merged', () => {
  const c=fixture(); c.es['@removedKey']={description:'Old'};
  assert.match(errors(c), /es:@removedKey: orphan metadata/);
});
test('unsupported ICU argument format fails closed', () => {
  const c=fixture(); c.fr.amount='{amount, number} {currency}';
  assert.match(errors(c), /fr:amount: ICU syntax: unsupported ICU format number/);
});
test('brand translation drift fails', () => {
  const c=fixture(); c.pt.appTitle='Example';
  assert.match(errors(c), /pt:appTitle: brand name changed/);
});
test('wrong locale tag and empty text fails', () => {
  const c=fixture(); c.ha['@@locale']='zz'; c.ha.appTitle=' ';
  assert.match(errors(c), /ha:@@locale: expected ha/);
  assert.match(errors(c), /ha:appTitle: translation must be nonempty string/);
});
test('real directory parser catches corrupt JSON without stack trace', () => {
  const dir=mkdtempSync(join(tmpdir(), 'masanawa-f07-'));
  try {
    for (const l of SUPPORTED) writeFileSync(join(dir, 'app_'+l+'.arb'), JSON.stringify(fixture()[l]));
    assert.equal(auditDirectory(dir).ok, true);
    writeFileSync(join(dir, 'app_ar.arb'), '{BROKEN');
    const result=auditDirectory(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /ar: could not parse\/read ARB/);
  } finally {rmSync(dir, {recursive:true, force:true});}
});
