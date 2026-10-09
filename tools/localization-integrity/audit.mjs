#!/usr/bin/env node
// Fail-closed read-only check for Flutter ARB merge integrity; no dependencies.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const SUPPORTED = ['en', 'ar', 'es', 'fr', 'pt', 'ha'];

function icu(value) {
  const names = new Set(); let i = 0;
  const space = () => { while (i < value.length && /\s/.test(value[i])) i++; };
  const name = () => {
    const start = i;
    while (i < value.length && /[a-zA-Z0-9_]/.test(value[i])) i++;
    if (start === i || !/[a-zA-Z_]/.test(value[start])) throw Error('invalid identifier at ' + start);
    return value.slice(start, i);
  };
  function group(nested) {
    while (i < value.length) {
      if (value[i] === '}') {
        if (!nested) throw Error('unmatched } at ' + i);
        i++; return;
      }
      if (value[i] === '{') { expression(); continue; }
      if (value[i] === "'" && value[i+1] === "'") { i += 2; continue; }
      if (value[i] === "'" && /[{}#]/.test(value[i+1] || '')) {
        i++; while (i < value.length) {
          if (value[i] === "'" && value[i+1] === "'") { i+=2; continue; }
          if (value[i++] === "'") break;
        }
        continue;
      }
      i++;
    }
    if (nested) throw Error('unclosed {');
  }
  function expression() {
    i++; space(); const variable = name(); names.add(variable); space();
    if (value[i] === '}') { i++; return; }
    if (value[i++] !== ',') throw Error('missing ICU comma for ' + variable);
    space(); const kind = name(); space();
    if (!['plural','select','selectordinal'].includes(kind)) throw Error('unsupported ICU format ' + kind + ' for ' + variable);
    if (value[i++] !== ',') throw Error('missing ICU options for ' + variable);
    let other = false, count = 0;
    while (i < value.length) {
      space();
      if (value[i] === '}') {
        if (!count || !other) throw Error(kind + ' ' + variable + ' requires an other option');
        i++; return;
      }
      const start = i;
      if (value[i] === '=') { i++; while (/\d/.test(value[i] || '')) i++; }
      else name();
      const selector = value.slice(start, i);
      if (!selector || selector === '=' || (selector.startsWith('=') && !/^=\d+$/.test(selector))) throw Error('invalid selector for ' + variable);
      if (selector === 'other') other = true;
      space(); if (value[i++] !== '{') throw Error('missing option body for ' + variable);
      group(true); count++;
    }
    throw Error('unclosed ' + kind + ' for ' + variable);
  }
  group(false); return names;
}
const sorted = items => [...items].sort().join(',');
const keys = obj => Object.keys(obj).filter(k => !k.startsWith('@'));
export function auditCatalogs(catalogs, locales = SUPPORTED) {
  const errors = [], counts = {}, report = (l,k,msg) => errors.push(l + ':' + k + ': ' + msg);
  const en = catalogs.en;
  if (!en || typeof en !== 'object' || Array.isArray(en)) return {ok:false,errors:['en: missing base catalog'],counts};
  const canonical = keys(en), allowed = new Set(canonical);
  for (const locale of locales) {
    const cat = catalogs[locale];
    if (!cat || typeof cat !== 'object' || Array.isArray(cat)) {report(locale,'@@locale','missing catalog'); continue;}
    if (cat['@@locale'] !== locale) report(locale,'@@locale','expected ' + locale);
    counts[locale] = keys(cat).length;
    for (const k of canonical) if (!Object.hasOwn(cat,k)) report(locale,k,'missing translation key');
    for (const k of keys(cat)) if (!allowed.has(k)) report(locale,k,'unexpected translation key');
    for (const [k,v] of Object.entries(cat)) {
      if (k.startsWith('@@')) continue;
      if (k.startsWith('@')) { if (!allowed.has(k.slice(1))) report(locale,k,'orphan metadata'); continue; }
      if (typeof v !== 'string' || !v.trim()) {report(locale,k,'translation must be nonempty string'); continue;}
      try {
        const actual = icu(v), expected = typeof en[k] === 'string' ? icu(en[k]) : new Set();
        if (sorted(actual) !== sorted(expected)) report(locale,k,'placeholder set ' + (sorted(actual)||'∅') + ' differs from en ' + (sorted(expected)||'∅'));
        const meta = cat['@'+k] ?? en['@'+k]; const declared = meta?.placeholders;
        if (declared !== undefined) {
          if (!declared || typeof declared !== 'object' || Array.isArray(declared)) report(locale,k,'invalid placeholders metadata');
          else if (sorted(Object.keys(declared)) !== sorted(actual)) report(locale,k,'metadata declares ' + (sorted(Object.keys(declared))||'∅') + ' but text uses ' + (sorted(actual)||'∅'));
        }
      } catch (error) {report(locale,k,'ICU syntax: ' + error.message);}
    }
    if (locale !== 'en' && typeof en.appTitle === 'string' && cat.appTitle !== en.appTitle) report(locale,'appTitle','brand name changed');
  }
  return {ok: errors.length === 0,errors,counts};
}
export function auditDirectory(directory,locales=SUPPORTED) {
  const catalogs={}, errors=[];
  for (const locale of locales) {
    try {catalogs[locale]=JSON.parse(readFileSync(resolve(directory,'app_'+locale+'.arb'),'utf8'));}
    catch(error){errors.push(locale+': could not parse/read ARB: '+error.message);}
  }
  const result=auditCatalogs(catalogs,locales);
  return {...result,ok:!errors.length&&result.ok,errors:[...errors,...result.errors]};
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const result=auditDirectory(process.argv[2]||'apps/mobile/lib/l10n');
  console.log(JSON.stringify(result,null,2));
  if (!result.ok) process.exitCode=1;
}
