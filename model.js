'use strict';
const KEY='nutrition-os-pwa-v1'; // Keep v1 storage identity for an in-place upgrade.
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
function freshState(){return {version:2,days:{},weights:{},shop:{},shoppingWeeks:{},shoppingItems:clone(DEFAULT_SHOP),templates:clone(MEALS),settings:{theme:'dark',goals:clone(DEFAULT_GOALS)},updatedAt:null}}
function assert(ok,message){if(!ok)throw Error(message)}
function record(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)}
function number(x,min,max,label){assert(typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max,`Invalid ${label}`);return x}
function safeMeal(m){assert(record(m)&&typeof m.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(m.id)&&!['__proto__','constructor','prototype'].includes(m.id),'Invalid food ID');assert(typeof m.name==='string'&&m.name.trim().length>0&&m.name.length<=100,'Invalid food name');assert(Array.isArray(m.foods)&&m.foods.length<=100&&m.foods.every(f=>typeof f==='string'&&f.length<=1500),'Invalid ingredients');const out={id:m.id,name:m.name,foods:[...m.foods]};for(const k of MACROS)out[k]=number(m[k],0,k==='kcal'?20000:2000,k);return out}
function safeMeals(list){assert(Array.isArray(list)&&list.length<=200,'Invalid meals');const out=list.map(safeMeal);assert(new Set(out.map(m=>m.id)).size===out.length,'Duplicate food IDs');return out}
function safeGoals(g){assert(record(g),'Invalid targets');const out={};for(const k of MACROS)out[k]=number(g[k],k==='kcal'?1:0,k==='kcal'?20000:2000,'target '+k);out.water=number(g.water,.25,10,'water target');assert(Math.abs(out.water*4-Math.round(out.water*4))<.0001,'Water target must use 250ml steps');return out}
function safeTicks(obj,keys){assert(record(obj),'Invalid checkboxes');const out={};for(const [k,v] of Object.entries(obj)){assert(keys.includes(k)&&typeof v==='boolean','Invalid checkbox');out[k]=v}return out}
function makeDay(state){return {meals:clone(state.templates),completed:{},supplements:{},water:0,waterRecorded:false,goals:clone(state.settings.goals),updatedAt:null}}
function normalize(raw){
 assert(record(raw)&&record(raw.days)&&record(raw.weights)&&record(raw.shop),'Not a Nutrition OS backup');
 assert(raw.version===undefined||raw.version===1||raw.version===2,'Unsupported backup version');
 const s=freshState();
 if(raw.version===2){
  assert(record(raw.settings)&&['dark','light','system'].includes(raw.settings.theme),'Invalid settings');s.settings={theme:raw.settings.theme,goals:safeGoals(raw.settings.goals)};
  s.templates=safeMeals(raw.templates);assert(s.templates.length===3&&MEALS.every(m=>s.templates.some(t=>t.id===m.id)),'Missing default meals');
  assert(Array.isArray(raw.shoppingItems)&&raw.shoppingItems.length===DEFAULT_SHOP.length,'Invalid shopping list');
  s.shoppingItems=raw.shoppingItems.map(i=>{assert(record(i)&&typeof i.name==='string'&&i.name.length<=200,'Invalid shopping item');return {name:i.name,price:number(i.price,0,10000,'price')}});
  assert(record(raw.shoppingWeeks),'Invalid shopping weeks');
  for(const [wk,ticks] of Object.entries(raw.shoppingWeeks)){assert(validDate(wk)&&weekStart(wk)===wk,'Invalid shopping week');s.shoppingWeeks[wk]=safeTicks(ticks,DEFAULT_SHOP.map((_,i)=>String(i)))}
 }
 assert(Object.keys(raw.days).length<=30000&&Object.keys(raw.weights).length<=30000,'Too many records');
 for(const [date,d] of Object.entries(raw.days)){
  assert(validDate(date)&&record(d),'Invalid daily record');const out=makeDay(s);
  if(raw.version===2){out.meals=safeMeals(d.meals);out.completed=safeTicks(d.completed,out.meals.map(m=>m.id));out.supplements=safeTicks(d.supplements,SUPPS.map(s=>s[0]));out.goals=safeGoals(d.goals);out.water=number(d.water,0,10,'water');assert(typeof d.waterRecorded==='boolean','Invalid water status');out.waterRecorded=d.waterRecorded;out.updatedAt=typeof d.updatedAt==='string'?d.updatedAt:null;}
  else{out.meals=clone(MEALS);out.goals=clone(DEFAULT_GOALS);for(const m of MEALS){if(d[m.id]!==undefined){assert(typeof d[m.id]==='boolean','Invalid meal tick');out.completed[m.id]=d[m.id]}}for(const [id] of SUPPS){if(d[id]!==undefined){assert(typeof d[id]==='boolean','Invalid supplement tick');out.supplements[id]=d[id]}}if(d.water!==undefined){out.water=number(d.water,0,10,'water');out.waterRecorded=true}}
  s.days[date]=out;
 }
 for(const [date,w] of Object.entries(raw.weights)){assert(validDate(date),'Invalid weigh-in date');s.weights[date]=number(w,30,250,'weight')}
 s.shop=safeTicks(raw.shop,DEFAULT_SHOP.map((_,i)=>String(i)));
 if(raw.version!==2&&Object.keys(s.shop).length)s.shoppingWeeks[weekStart(localDay())]=clone(s.shop);
 s.updatedAt=typeof raw.updatedAt==='string'?raw.updatedAt:null;return s;
}
function totals(d){const eaten=d.meals.filter(m=>d.completed[m.id]);return {...sumMeals(eaten),count:eaten.filter(m=>MEALS.some(base=>base.id===m.id)).length,foods:eaten.length}}
function dailySummary(s,date){const d=s.days[date];if(!d)return {date,logged:false,weightKg:s.weights[date]??null};const t=totals(d);return {date,logged:true,...t,waterLitres:d.waterRecorded?d.water:null,waterGoalLitres:d.goals.water,waterGoalMet:d.waterRecorded?d.water>=d.goals.water:null,calorieGoalMet:t.kcal>=d.goals.kcal,proteinGoalMet:t.p>=d.goals.p,targets:clone(d.goals),weightKg:s.weights[date]??null,meals:d.meals.map(m=>({...clone(m),eaten:!!d.completed[m.id]})),supplements:clone(d.supplements),updatedAt:d.updatedAt}}
function weekSummary(s,start){const dates=Array.from({length:7},(_,i)=>shiftDate(start,i));const logged=dates.filter(d=>s.days[d]);const waterDays=logged.filter(d=>s.days[d].waterRecorded);const weights=dates.filter(d=>s.weights[d]!==undefined).map(d=>s.weights[d]);return {start,dates,loggedDays:logged.length,avgKcal:logged.length?Math.round(logged.reduce((n,d)=>n+totals(s.days[d]).kcal,0)/logged.length):null,completeDays:logged.filter(d=>totals(s.days[d]).count===3).length,waterLoggedDays:waterDays.length,waterGoalDays:waterDays.filter(d=>s.days[d].water>=s.days[d].goals.water).length,avgWeight:weights.length?round(weights.reduce((a,b)=>a+b,0)/weights.length):null}}
