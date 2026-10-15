// Lightweight DOM harness: checks app startup and state transitions, not visual rendering.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
function element(id){const fields={};return {id,value:'',textContent:'',innerHTML:'',style:{},dataset:{},hidden:false,checked:false,classList:{toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},getContext(){return null},elements:{namedItem(name){return fields[name]??={value:'',checked:false}}},reset(){for(const f of Object.values(fields)){f.value='';f.checked=false}},showModal(){this.open=true},close(){this.open=false}}}
const nodes=Object.fromEntries(ids.map(id=>[id,element(id)])),handlers={},storage=new Map(),notices=[];
const context=vm.createContext({console,Date,JSON,Number,Set,Math,Object,Array,Error,Intl,URL,Blob,crypto:require('node:crypto').webcrypto,location:{protocol:'file:',reload(){}},navigator:{onLine:true},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},matchMedia:()=>({matches:false,addEventListener(){}}),document:{getElementById:id=>{assert(nodes[id],id);return nodes[id]},documentElement:{dataset:{}},querySelector:()=>element('meta'),querySelectorAll:()=>[],addEventListener:(n,fn)=>handlers[n]=fn,hidden:false},window:{addEventListener(){},scrollTo(){}},setTimeout:()=>1,clearTimeout(){},setInterval(){},alert:m=>notices.push(m),confirm:()=>true});
vm.runInContext(fs.readFileSync(path.join(root,'model.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'app.js'),'utf8'),context);
vm.runInContext('accountReady=true',context);
assert.equal(nodes.calories.textContent,'0');
handlers.change({target:{dataset:{meal:'breakfast'},checked:true}});assert.equal(nodes.calories.textContent,'1,355');
handlers.change({target:{dataset:{meal:'breakfast'},checked:false}});assert.equal(nodes.calories.textContent,'0');
nodes.addWater.onclick();assert.equal(nodes.water.value,.25);
vm.runInContext("selectDate('2026-10-14')",context);assert.equal(nodes.saveWeight.disabled,true);nodes.weight.value='70.2';nodes.saveWeight.onclick();assert.equal(vm.runInContext("state.weights['2026-10-14']",context),undefined);
vm.runInContext("selectDate('2026-10-12')",context);assert.equal(nodes.saveWeight.disabled,false);nodes.weight.value='70.2';nodes.saveWeight.onclick();assert.equal(vm.runInContext("state.weights['2026-10-12']",context),70.2);
vm.runInContext("selectDate('2026-10-11')",context);assert.equal(nodes.saveWeight.disabled,true);assert.match(nodes.weighHint.textContent,/Monday 12 October/);
nodes.goToday.onclick();
nodes.addFood.onclick();const f=nodes.foodForm;
for(const [k,v] of Object.entries({name:'<script>snack</script>',foods:'150g',kcal:'100',p:'10',c:'10',f:'2',fi:'0'}))f.elements.namedItem(k).value=v;
f.elements.namedItem('eaten').checked=true;f.onsubmit({preventDefault(){},target:f});
assert.equal(nodes.calories.textContent,'100');assert(nodes.mealCards.innerHTML.includes('&lt;script&gt;'));
nodes.theme.onchange({target:{value:'light'}});assert.equal(context.document.documentElement.dataset.theme,'light');
nodes.prevDay.onclick();assert.equal(nodes.calories.textContent,'0');nodes.goToday.onclick();assert.equal(nodes.calories.textContent,'100');
console.log('PASS: app startup, meal check/uncheck, water, Monday-only weight, custom food, escaping, themes, day navigation and persistence.');
