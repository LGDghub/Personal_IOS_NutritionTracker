'use strict';
const LEGACY_KEY='nutrition-os-pwa-v1'; let KEY=LEGACY_KEY; // Keep v1 storage identity for an in-place upgrade.
const MEALS=[
{id:'breakfast',name:'Breakfast',kcal:1355,p:61,c:157,f:50,fi:17,foods:['100g oats','400ml whole milk','1 banana','20g dark chocolate','80g strawberries','36g blueberries','3 large eggs','2 slices wholemeal bread']},
{id:'lunch',name:'Lunch',kcal:778,p:66,c:86,f:17,fi:7,foods:['250g 5% beef mince','250g ready-cooked rice pouch','80g carrots','100g sweetcorn']},
{id:'dinner',name:'Dinner',kcal:889,p:55,c:119,f:17,fi:13,foods:['150g chicken breast','500g potatoes','80g carrots','100g sweetcorn','300ml whole milk']}];
const SUPPS=[['creatine','Creatine · 5g'],['vitd','Vitamin D3'],['omega','Omega-3'],['mag','Magnesium · optional']];
const SHOP=[['4 × 500g 5% beef mince','£20.76'],['2 × 1kg chicken breast','£13.38'],['2 × 12 large eggs','£6.60'],['3 × 4-pint whole milk','£4.95'],['1 × 1kg oats','£0.85'],['7 × 250g rice pouches','£4.90'],['2 × 2kg potatoes','£3.60'],['1 wholemeal loaf','£0.75'],['2 × 6-pack bananas','£1.50'],['1 × 600g strawberries','£3.75'],['1 × 250g blueberries','£2.75'],['2 × 100g dark chocolate','£7.00'],['2 × 1kg carrots','£1.38'],['7 × 200g sweetcorn','£3.50']];
const MACROS=['kcal','p','c','f','fi'];
const clone=x=>JSON.parse(JSON.stringify(x));
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
function localDay(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00');return !isNaN(d)&&localDay(d)===s&&s>='1900-01-01'&&s<='2200-12-31'}
function shiftDate(s,n){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return localDay(d)}
function weekStart(s){const d=new Date(s+'T12:00:00');return shiftDate(s,-((d.getDay()+6)%7))}
function dateNumber(s){return Date.parse(s+'T12:00:00Z')/86400000}
function sumMeals(meals){return meals.reduce((t,m)=>{for(const k of MACROS)t[k]=round(t[k]+m[k]);return t},Object.fromEntries(MACROS.map(k=>[k,0])))}
const DEFAULT_GOALS={...sumMeals(MEALS),water:3.5};
const DEFAULT_SHOP=SHOP.map(([name,price])=>({name,price:Number(price.replace('£',''))}));
const SHOP_UNITS=['mg','g','kg','oz','lb','ml','cl','L','fl oz','cup','pint','gallon','piece','pack'];
function legacyShopItem(i){
 const match=i.name.match(/^(\d{1,4})\s*[×x]\s*(.+)$/i),quantity=match?Number(match[1]):1,cents=Math.round(i.price*100);
 if(!match||quantity>1000||cents%quantity!==0)return {name:i.name,quantity:1,size:0,unit:'piece',price:i.price};
 let name=match[2],size=0,unit='piece';const measured=name.match(/^(\d+(?:\.\d+)?)\s*(mg|kg|g|oz|lb|ml|cl|l|fl oz|cups?|pints?|gallons?)\b\s*(.+)$/i);
 if(measured){size=Number(measured[1]);unit=measured[2].toLowerCase().replace(/s$/,'');if(unit==='l')unit='L';name=measured[3]}
 return {name,quantity,size,unit,price:cents/quantity/100};
}
function safeShopItem(i){
 assert(record(i)&&typeof i.name==='string'&&i.name.trim()&&i.name.length<=200,'Invalid shopping item');
 const price=number(i.price,0,10000,'unit price');assert(Math.abs(price*100-Math.round(price*100))<.00001,'Unit price must be in pence');
 if(i.quantity===undefined)return legacyShopItem(i); // Old line totals remain exact.
 const quantity=number(i.quantity,1,1000,'quantity');assert(Number.isInteger(quantity),'Quantity must be a whole number');
 const size=number(i.size,0,100000,'pack size');assert(Math.round(size*1000)===size*1000,'Invalid pack size');
 assert(SHOP_UNITS.includes(i.unit),'Invalid unit');assert(Math.round(quantity*price*100)<=100000000,'Shopping line too expensive');
 return {name:i.name.trim(),quantity,size,unit:i.unit,price};
}
function shopLine(i){return Math.round(i.quantity*i.price*100)}
function shopSubtotal(items){return items.reduce((sum,i)=>sum+shopLine(i),0)}
function shopDiscount(subtotal,discount){return discount.type==='percent'?Math.round(subtotal*discount.value/100):Math.min(subtotal,Math.round(discount.value*100))}
function safeDiscount(d){assert(record(d)&&['percent','amount'].includes(d.type),'Invalid discount');const value=number(d.value,0,d.type==='percent'?100:10000,'discount');assert(Math.round(value*100)===value*100,'Invalid discount precision');return {type:d.type,value}}
function freshState(){return {version:3,shoppingFormat:2,supplementItems:clone(SUPPS),supplementStock:{},days:{},weights:{},shop:{},shoppingWeeks:{},shoppingDiscounts:{},shoppingItems:clone(DEFAULT_SHOP).map(safeShopItem),templates:clone(MEALS),settings:{theme:'dark',goals:clone(DEFAULT_GOALS)},updatedAt:null}}
function assert(ok,message){if(!ok)throw Error(message)}
function record(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)}
function number(x,min,max,label){assert(typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max,`Invalid ${label}`);return x}
function safeMeal(m){assert(record(m)&&typeof m.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(m.id)&&!['__proto__','constructor','prototype'].includes(m.id),'Invalid food ID');assert(typeof m.name==='string'&&m.name.trim().length>0&&m.name.length<=100,'Invalid food name');assert(Array.isArray(m.foods)&&m.foods.length<=100&&m.foods.every(f=>typeof f==='string'&&f.length<=1500),'Invalid ingredients');const out={id:m.id,name:m.name,foods:[...m.foods]};for(const k of MACROS)out[k]=number(m[k],0,k==='kcal'?20000:2000,k);return out}
function safeMeals(list){assert(Array.isArray(list)&&list.length<=200,'Invalid meals');const out=list.map(safeMeal);assert(new Set(out.map(m=>m.id)).size===out.length,'Duplicate food IDs');return out}
function safeGoals(g,allowUnset=false){assert(record(g),'Invalid targets');if(allowUnset&&[...MACROS,'water'].every(k=>g[k]===0))return Object.fromEntries([...MACROS,'water'].map(k=>[k,0]));const out={};for(const k of MACROS)out[k]=number(g[k],k==='kcal'&&!allowUnset?1:0,k==='kcal'?20000:2000,'target '+k);out.water=number(g.water,allowUnset?0:.25,10,'water target');assert(Math.abs(out.water*4-Math.round(out.water*4))<.0001,'Water target must use 250ml steps');return out}
function safeTicks(obj,keys){assert(record(obj),'Invalid checkboxes');const out={};for(const [k,v] of Object.entries(obj)){assert(keys.includes(k)&&typeof v==='boolean','Invalid checkbox');out[k]=v}return out}
function makeDay(state){return {meals:clone(state.templates),completed:{},supplements:{},water:0,waterRecorded:false,goals:clone(state.settings.goals),updatedAt:null}}
function normalize(raw){
 assert(record(raw)&&record(raw.days)&&record(raw.weights)&&record(raw.shop),'Not a Personal WFW Tracker backup');
 assert(raw.version===undefined||raw.version===1||raw.version===2||raw.version===3,'Unsupported backup version');
 const s=freshState();
 if(raw.supplementItems!==undefined)s.supplementItems=safeSupplements(raw.supplementItems);
 if(raw.version>=2){
  assert(record(raw.settings)&&['dark','light','system'].includes(raw.settings.theme),'Invalid settings');s.settings={theme:raw.settings.theme,goals:safeGoals(raw.settings.goals,true)};
  if(raw.settings.steps!==undefined)s.settings.steps=number(raw.settings.steps,0,100000,'steps target');
  s.templates=safeMeals(raw.templates);assert(s.templates.length===3&&MEALS.every(m=>s.templates.some(t=>t.id===m.id)),'Missing default meals');
  assert(Array.isArray(raw.shoppingItems)&&raw.shoppingItems.length<=200,'Invalid shopping list');
  s.shoppingItems=raw.shoppingItems.map(safeShopItem);
  assert(record(raw.shoppingWeeks),'Invalid shopping weeks');
  for(const [wk,ticks] of Object.entries(raw.shoppingWeeks)){assert(validDate(wk)&&weekStart(wk)===wk,'Invalid shopping week');s.shoppingWeeks[wk]=safeTicks(ticks,s.shoppingItems.map((_,i)=>String(i)))}
  if(raw.shoppingDiscounts!==undefined){assert(record(raw.shoppingDiscounts),'Invalid discounts');for(const [wk,d] of Object.entries(raw.shoppingDiscounts)){assert(validDate(wk)&&weekStart(wk)===wk,'Invalid discount week');s.shoppingDiscounts[wk]=safeDiscount(d)}}
 }
 assert(Object.keys(raw.days).length<=30000&&Object.keys(raw.weights).length<=30000,'Too many records');
 for(const [date,d] of Object.entries(raw.days)){
  assert(validDate(date)&&record(d),'Invalid daily record');const out=makeDay(s);
  if(raw.version>=2){out.meals=safeMeals(d.meals);out.completed=safeTicks(d.completed,out.meals.map(m=>m.id));out.supplements=safeTicks(d.supplements,s.supplementItems.map(s=>s[0]));out.goals=safeGoals(d.goals,true);out.water=number(d.water,0,10,'water');assert(typeof d.waterRecorded==='boolean','Invalid water status');out.waterRecorded=d.waterRecorded;out.updatedAt=typeof d.updatedAt==='string'?d.updatedAt:null;}
  else{out.meals=clone(MEALS);out.goals=clone(DEFAULT_GOALS);for(const m of MEALS){if(d[m.id]!==undefined){assert(typeof d[m.id]==='boolean','Invalid meal tick');out.completed[m.id]=d[m.id]}}for(const [id] of SUPPS){if(d[id]!==undefined){assert(typeof d[id]==='boolean','Invalid supplement tick');out.supplements[id]=d[id]}}if(d.water!==undefined){out.water=number(d.water,0,10,'water');out.waterRecorded=true}}
  s.days[date]=out;
 }
 for(const [date,w] of Object.entries(raw.weights)){assert(validDate(date),'Invalid weigh-in date');s.weights[date]=number(w,30,250,'weight')}
 s.shop=safeTicks(raw.shop,(raw.version>=2?s.shoppingItems:DEFAULT_SHOP).map((_,i)=>String(i)));
 if(!(raw.version>=2)&&Object.keys(s.shop).length)s.shoppingWeeks[weekStart(localDay())]=clone(s.shop);
 if(raw.version===3){assert(record(raw.supplementStock),'Invalid stock');for(const [id,v] of Object.entries(raw.supplementStock)){assert(s.supplementItems.some(x=>x[0]===id)&&record(v),'Invalid supplement');s.supplementStock[id]={balance:number(v.balance,0,100000,'stock'),dose:number(v.dose,.01,10000,'dose'),threshold:number(v.threshold,0,100000,'threshold'),anchorCount:number(v.anchorCount,0,30000,'stock baseline'),unit:String(v.unit).slice(0,30),cycle:String(v.cycle).slice(0,80)}}}
 s.shoppingFormat=2;s.updatedAt=typeof raw.updatedAt==='string'?raw.updatedAt:null;return s;
}
function totals(d){const eaten=d.meals.filter(m=>d.completed[m.id]);return {...sumMeals(eaten),count:eaten.filter(m=>MEALS.some(base=>base.id===m.id)).length,foods:eaten.length}}
function dailySummary(s,date){const d=s.days[date];if(!d)return {date,logged:false,weightKg:s.weights[date]??null};const t=totals(d);return {date,logged:true,...t,waterLitres:d.waterRecorded?d.water:null,waterGoalLitres:d.goals.water,waterGoalMet:d.waterRecorded&&d.goals.water>0?d.water>=d.goals.water:null,calorieGoalMet:d.goals.kcal>0?t.kcal>=d.goals.kcal:null,proteinGoalMet:d.goals.kcal>0?t.p>=d.goals.p:null,targets:clone(d.goals),weightKg:s.weights[date]??null,meals:d.meals.map(m=>({...clone(m),eaten:!!d.completed[m.id]})),supplements:clone(d.supplements),updatedAt:d.updatedAt}}
function weekSummary(s,start){const dates=Array.from({length:7},(_,i)=>shiftDate(start,i));const logged=dates.filter(d=>s.days[d]);const waterDays=logged.filter(d=>s.days[d].waterRecorded);const weights=dates.filter(d=>s.weights[d]!==undefined).map(d=>s.weights[d]);return {start,dates,loggedDays:logged.length,avgKcal:logged.length?Math.round(logged.reduce((n,d)=>n+totals(s.days[d]).kcal,0)/logged.length):null,completeDays:logged.filter(d=>totals(s.days[d]).count===3).length,waterLoggedDays:waterDays.length,waterGoalDays:waterDays.filter(d=>s.days[d].goals.water>0&&s.days[d].water>=s.days[d].goals.water).length,avgWeight:weights.length?round(weights.reduce((a,b)=>a+b,0)/weights.length):null}}

function supplementTicks(s,id){return Object.values(s.days).filter(d=>d.supplements[id]).length}
function stockRemaining(s,id){const v=s.supplementStock[id];return v?round(v.balance-v.dose*(supplementTicks(s,id)-v.anchorCount)):null}
function setStock(s,id,balance,dose,threshold,unit,cycle){assert(s.supplementItems.some(x=>x[0]===id&&!x[2]),'Unknown supplement');s.supplementStock[id]={balance:number(balance,0,100000,'stock'),dose:number(dose,.01,10000,'dose'),threshold:number(threshold,0,100000,'threshold'),unit:String(unit).slice(0,30),anchorCount:supplementTicks(s,id),cycle};return s}
function newAccountState(){const s=freshState();s.templates=s.templates.map(m=>({...m,foods:[],kcal:0,p:0,c:0,f:0,fi:0}));s.shoppingItems=[];s.supplementItems=[];s.settings={theme:'light',goals:Object.fromEntries([...MACROS,'water'].map(k=>[k,0]))};return s}

function removeShoppingItem(s,index){
 assert(Number.isInteger(index)&&index>=0&&index<s.shoppingItems.length,'Invalid shopping index');
 const remap=ticks=>Object.fromEntries(Object.entries(ticks).filter(([k])=>Number(k)!==index).map(([k,v])=>[String(Number(k)>index?Number(k)-1:Number(k)),v]));
 s.shoppingItems.splice(index,1);s.shop=remap(s.shop);
 for(const wk of Object.keys(s.shoppingWeeks))s.shoppingWeeks[wk]=remap(s.shoppingWeeks[wk]);
}

function safeSupplements(items){
 assert(Array.isArray(items)&&items.length<=200,'Maximum 200 supplements');
 const out=items.map(v=>{assert(Array.isArray(v)&&(v.length===2||v.length===3&&v[2]===true)&&typeof v[0]==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v[0])&&!['__proto__','constructor','prototype'].includes(v[0]),'Invalid supplement ID');assert(typeof v[1]==='string'&&v[1].trim().length>0&&v[1].length<=100,'Enter a supplement name of 1–100 characters');return v[2]===true?[v[0],v[1].trim(),true]:[v[0],v[1].trim()]});
 assert(new Set(out.map(v=>v[0])).size===out.length,'Duplicate supplement IDs');return out;
}
function addSupplement(s,id,name){s.supplementItems=safeSupplements([...s.supplementItems,[id,name]])}
function renameSupplement(s,id,name){assert(s.supplementItems.some(v=>v[0]===id),'Unknown supplement');s.supplementItems=safeSupplements(s.supplementItems.map(v=>v[0]===id?[id,name]:v))}

function activeSupplements(s){return s.supplementItems.filter(v=>!v[2])}
function removeSupplement(s,id){
 assert(activeSupplements(s).some(v=>v[0]===id),'Unknown supplement');
 s.supplementItems=s.supplementItems.map(v=>v[0]===id?[v[0],v[1],true]:v);
 delete s.supplementStock[id];
}

