const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c=vm.createContext({console,testAssert:assert,Date,Math,JSON,Number,Set,Object,Array,Error});
vm.runInContext(fs.readFileSync('model.js','utf8')+`
const s=freshState();s.days['2026-10-12']=makeDay(s);s.days['2026-10-12'].supplements.vitd=true;
setStock(s,'vitd',20,1,5,'tablets','cycle1');testAssert.equal(stockRemaining(s,'vitd'),20);
s.days['2026-10-13']=makeDay(s);s.days['2026-10-13'].supplements.vitd=true;testAssert.equal(stockRemaining(s,'vitd'),19);
s.days['2026-10-13'].supplements.vitd=true;testAssert.equal(stockRemaining(s,'vitd'),19);
s.days['2026-10-13'].supplements.vitd=false;testAssert.equal(stockRemaining(s,'vitd'),20);
s.days['2026-10-13'].supplements.vitd=true;setStock(s,'vitd',40,2,6,'tablets','cycle2');testAssert.equal(stockRemaining(s,'vitd'),40);
s.days['2026-10-14']=makeDay(s);s.days['2026-10-14'].supplements.vitd=true;testAssert.equal(stockRemaining(s,'vitd'),38);
testAssert.equal(stockRemaining(normalize(JSON.parse(JSON.stringify(s))),'vitd'),38);
const old=clone(s);old.version=2;delete old.supplementStock;testAssert.equal(Object.keys(normalize(old).supplementStock).length,0);
testAssert.throws(()=>setStock(s,'vitd',-1,1,5,'tablets','bad'));
testAssert.equal(newAccountState().templates[0].foods.length,0);
`,c);
console.log('PASS: stock baseline, idempotent ticks, undo, restock, dose changes, backup roundtrip, legacy migration, blank friend meals.');
