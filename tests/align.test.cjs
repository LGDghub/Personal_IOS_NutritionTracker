// Lightweight DOM harness: checks app startup and state transitions, not visual rendering.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
function element(id){const fields={};return {id,value:'',textContent:'',innerHTML:'',style:{},dataset:{},hidden:false,checked:false,classList:{toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},getContext(){return null},elements:{namedItem(name){return fields[name]??={value:'',checked:false}}},reset(){for(const f of Object.values(fields)){f.value='';f.checked=false}},showModal(){this.open=true},close(){this.open=false}}}
const nodes=Object.fromEntries(ids.map(id=>[id,element(id)])),handlers={},storage=new Map(),notices=[];
const context=vm.createContext({console,Date,JSON,Number,Set,Math,Object,Array,Error,Intl,URL,Blob,crypto:require('node:crypto').webcrypto,location:{protocol:'file:',reload(){}},navigator:{onLine:true},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},matchMedia:()=>({matches:false,addEventListener(){}}),document:{body:{dataset:{}},getElementById:id=>{assert(nodes[id],id);return nodes[id]},documentElement:{dataset:{}},querySelector:()=>element('meta'),querySelectorAll:()=>[],addEventListener:(n,fn)=>handlers[n]=fn,hidden:false},window:{addEventListener(){},scrollTo(){}},setTimeout:()=>1,clearTimeout(){},setInterval(){},alert:m=>notices.push(m),confirm:()=>true});
vm.runInContext(fs.readFileSync(path.join(root,'model.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'app.js'),'utf8'),context);

context.URLSearchParams=URLSearchParams;
context.navigator.userAgent='iPhone';context.navigator.platform='iPhone';
let callback,signupArgs,feedbackArgs,feedbackError=null,updated=[];
const mock={auth:{onAuthStateChange(fn){callback=fn},async signUp(args){signupArgs=args;return {data:{session:null},error:null}},async signInWithPassword(){return {data:{session:{}},error:null}},async updateUser(args){updated.push(args);return {error:null}},async resend(){return {error:null}}},from(table){return {select(){return {eq(){return {async maybeSingle(){return {data:null,error:null}}}}}},async insert(args){feedbackArgs=args;return {error:feedbackError}}}}};
context.supabase={createClient:()=>mock};
vm.runInContext(fs.readFileSync(path.join(root,'sync.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'align.js'),'utf8'),context);
const run=s=>vm.runInContext(s,context),event={preventDefault(){}};
(async()=>{
 assert.equal(nodes.authSubmit.value,'signup');assert.equal(nodes.signupName.required,true);
 nodes.authMode.onclick();assert.equal(nodes.authSubmit.value,'signin');assert.equal(nodes.signupName.hidden,false);assert.equal(nodes.signupNameLabel.hidden,true);
 nodes.authMode.onclick();nodes.signupName.value='Jamie';nodes.authEmail.value='jamie@example.com';nodes.authPassword.value='dummy-password';
 await nodes.authForm.onsubmit({...event,submitter:nodes.authSubmit});
 assert.equal(signupArgs.options.data.display_name,'Jamie');assert.equal(signupArgs.options.data.align_onboarding_version,2);assert.equal(nodes.confirmEmail.hidden,false);assert.equal(nodes.authForm.hidden,true);
 const user={id:'user-a',email:'jamie@example.com',user_metadata:{display_name:'Jamie',align_onboarding_version:1}};
 callback('SIGNED_IN',{user});await context.window.alignAccount(user);
 assert.equal(nodes.welcomeDialog.open,true);assert.match(nodes.welcomeTitle.textContent,/Jamie/);
 await nodes.skipWelcome.onclick();assert.equal(nodes.welcomeDialog.open,false);assert.equal(updated.at(-1).data.align_onboarding_done,true);
 await context.window.alignAccount(user);assert.equal(nodes.welcomeDialog.open,false);
 nodes.feedbackBody.value='Please add a step tracker';nodes.feedbackCategory.value='idea';await nodes.feedbackForm.onsubmit(event);
 assert.equal(feedbackArgs.user_id,'user-a');assert.equal(nodes.feedbackBody.value,'');assert.match(nodes.feedbackStatus.textContent,/sent privately/);
 feedbackError={message:'Offline'};nodes.feedbackBody.value='Keep my draft on failure';await nodes.feedbackForm.onsubmit(event);assert.equal(nodes.feedbackBody.value,'Keep my draft on failure');assert.match(nodes.feedbackStatus.textContent,/Not sent/);
 const other={id:'user-b',email:'other@example.com',user_metadata:{}};callback('SIGNED_IN',{user:other});await context.window.alignAccount(other);assert.equal(nodes.welcomeDialog.open,false);assert.equal(nodes.feedbackBody.value,'');assert.equal(nodes.feedbackInbox.hidden,true);
 const newcomer={id:'new-user',email:'new@example.com',user_metadata:{align_onboarding_version:2}};
 callback('SIGNED_IN',{user:newcomer});await context.window.alignAccount(newcomer);
 assert.equal(nodes.goalDialog.open,true);assert.equal(nodes.welcomeDialog.open,false);
 nodes.goalSetupForm.elements.namedItem('water').value='2.5';
 nodes.goalSetupForm.onsubmit(event);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(run('state.settings.goals.water'),2.5);assert.equal(run('goalIndex'),1);
 assert.equal(run('normalize(state).settings.goals.water'),2.5);
 nodes.goalSetupForm.elements.namedItem('kcal').value='2300';nodes.goalSetupForm.onsubmit(event);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(run('state.settings.goals.kcal'),2300);assert.equal(run('goalIndex'),2);
 await nodes.skipGoal.onclick();assert.equal(run('goalIndex'),3);
 nodes.goalSetupForm.elements.namedItem('steps').value='8000';nodes.goalSetupForm.onsubmit(event);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(run('normalize(state).settings.steps'),8000);assert.equal(nodes.goalDialog.open,false);assert.equal(nodes.welcomeDialog.open,true);
 assert(updated.some(x=>x.data.align_goals_done));
 const skipUser={id:'skip-user',email:'skip@example.com',user_metadata:{align_onboarding_version:2}};
 callback('SIGNED_IN',{user:skipUser});await context.window.alignAccount(skipUser);await nodes.skipGoals.onclick();
 assert.equal(nodes.goalDialog.open,false);assert.equal(nodes.welcomeDialog.open,true);assert.equal(run('state.settings.goals.kcal'),0);
 callback('SIGNED_OUT',null);await context.window.alignAccount(null);assert.equal(nodes.authSubmit.value,'signup');assert.equal(nodes.settingsCog.hidden,true);
 console.log('PASS: signup name and verification, sign-in mode, welcome once, legacy users, feedback failure preservation and account switching.');
})().catch(e=>{console.error(e);process.exitCode=1});

