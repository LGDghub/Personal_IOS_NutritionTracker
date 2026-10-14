// Lightweight DOM harness: checks app startup and state transitions, not visual rendering.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
function element(id){const fields={};return {id,value:'',textContent:'',innerHTML:'',style:{},dataset:{},hidden:false,checked:false,classList:{toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},getContext(){return null},elements:{namedItem(name){return fields[name]??={value:'',checked:false}}},reset(){for(const f of Object.values(fields)){f.value='';f.checked=false}},showModal(){this.open=true},close(){this.open=false}}}
const nodes=Object.fromEntries(ids.map(id=>[id,element(id)])),handlers={},storage=new Map(),notices=[];
const context=vm.createContext({console,Date,JSON,Number,Set,Math,Object,Array,Error,Intl,URL,Blob,crypto:require('node:crypto').webcrypto,location:{protocol:'file:',reload(){}},navigator:{onLine:true},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},matchMedia:()=>({matches:false,addEventListener(){}}),document:{getElementById:id=>{assert(nodes[id],id);return nodes[id]},documentElement:{dataset:{}},querySelector:()=>element('meta'),querySelectorAll:()=>[],addEventListener:(n,fn)=>handlers[n]=fn,hidden:false},window:{addEventListener(){},scrollTo(){}},setTimeout:()=>1,clearTimeout(){},setInterval(){},alert:m=>notices.push(m),confirm:()=>true});
vm.runInContext(fs.readFileSync(path.join(root,'model.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'app.js'),'utf8'),context);

context.URLSearchParams=URLSearchParams;
const sessionStore=new Map();context.sessionStorage={getItem:k=>sessionStore.get(k),setItem:(k,v)=>sessionStore.set(k,v),removeItem:k=>sessionStore.delete(k)};
let callback,requested=[],updated=[],resetError=null,updateError=null,reads=0;
const user={id:'owner',email:'owner@example.com'};
const mock={auth:{onAuthStateChange(fn){callback=fn},async resetPasswordForEmail(email,options){requested.push({email,options});return {error:resetError}},async updateUser(data){updated.push(data);if(!updateError)callback('USER_UPDATED',{user});return {error:updateError}}},from(){reads++;return {select(){return {eq(){return {async maybeSingle(){return {data:null,error:{message:'No network in test'}}}}}}}}}};
context.supabase={createClient:()=>mock};nodes.resetEmail.checkValidity=()=>true;nodes.resetEmail.reportValidity=()=>{};
vm.runInContext(fs.readFileSync(path.join(root,'sync.js'),'utf8'),context);
const event={preventDefault(){}};
(async()=>{
 nodes.resetEmail.value=' owner@example.com ';await nodes.resetEmailForm.onsubmit(event);
 assert.equal(requested.length,1);assert.equal(requested[0].email,'owner@example.com');assert.equal(requested[0].options.redirectTo,'https://lgdghub.github.io/Personal_IOS_NutritionTracker/');assert.equal(updated.length,0);assert.match(nodes.resetEmailMessage.textContent,/If an account exists/);
 resetError={message:'Rate limit'};await nodes.resetEmailForm.onsubmit(event);assert.match(nodes.resetEmailMessage.textContent,/Could not request/);assert.equal(nodes.sendResetEmail.disabled,false);
 // No reset session, no password write.
 nodes.newPassword.value='valid-password';nodes.confirmPassword.value='valid-password';await nodes.newPasswordForm.onsubmit(event);assert.equal(updated.length,0);
 callback('PASSWORD_RECOVERY',{user});assert.equal(nodes.newPasswordForm.hidden,false);assert.equal(sessionStore.get('wfw-password-recovery'),'owner');await vm.runInContext('syncNow()',context);assert.equal(reads,0);
 nodes.newPassword.value='short';nodes.confirmPassword.value='short';await nodes.newPasswordForm.onsubmit(event);assert.equal(updated.length,0);
 nodes.newPassword.value='valid-password';nodes.confirmPassword.value='different';await nodes.newPasswordForm.onsubmit(event);assert.equal(updated.length,0);assert.match(nodes.newPasswordMessage.textContent,/don’t match/);
 nodes.confirmPassword.value='valid-password';updateError={message:'Expired token'};await nodes.newPasswordForm.onsubmit(event);assert.equal(nodes.newPasswordForm.hidden,false);assert.match(nodes.newPasswordMessage.textContent,/not changed/);assert.equal(nodes.saveNewPassword.disabled,false);
 updateError=null;await nodes.newPasswordForm.onsubmit(event);assert.equal(nodes.newPasswordForm.hidden,true);assert.equal(nodes.newPassword.value,'');assert.equal(nodes.confirmPassword.value,'');assert.equal(sessionStore.size,0);assert.match(nodes.authMessage.textContent,/Password updated/);
 for(const value of storage.values())assert(!value.includes('valid-password'));
 console.log('PASS: email request, no automatic password change, retry, recovery session gating, sync pause, password validation, failure and success.');
})().catch(e=>{console.error(e);process.exitCode=1});
