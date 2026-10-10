// J18 source contract gate; full PostgreSQL18 seed+media+12 Rooms+24 Feed posts remains
// an integration test assigned to AF00 with L-ROOMS and L-FEED.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const base=fileURLToPath(new URL('../../../',import.meta.url));
test('J18 Masana fixture and independently owned seed are not treated as live content',async()=>{
 const data=JSON.parse(await readFile(base+'docs/rebuild/SEED-MASANA.json','utf8'));
 assert.equal(data.characters.length,12);
 assert.equal(data.characters.every(x=>x.kind==='platform_masana'),true);
 assert.equal(data.characters.every(x=>x.art?.assetExists===false),true);
 assert.equal(data.characters.every(x=>x.defaultRoom?.createdInDatabase===false),true);
});
