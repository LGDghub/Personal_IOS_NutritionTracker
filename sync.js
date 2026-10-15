'use strict';
// Only a public client key belongs here. Row-level security protects every record.
const resetReturnURL='https://lgdghub.github.io/Personal_IOS_NutritionTracker/';
let recoveryPending=new URLSearchParams(location.hash?.slice(1)||'').get('type')==='recovery',recoveryUserId=null;
try{recoveryUserId=sessionStorage.getItem('wfw-password-recovery')}catch{}
const cloud = supabase.createClient('https://zrtnabwryzbdqzwghxcp.supabase.co','sb_publishable_qKmHecgEm6v5_-WJR0ib_Q_G7gwbWmq');
let SYNC_KEY=KEY+'-cloud';
let syncMeta={},cloudUser=null,syncBusy=false,syncTimer,cloudConflict=null;
let accountGeneration=0;
function selectAccount(user){accountGeneration++;clearTimeout(syncTimer);accountReady=false;cloudConflict=null;state=newAccountState();syncMeta={};storageBlocked=false;
 try{if(user){KEY=LEGACY_KEY+'-account-'+user.id;SYNC_KEY=KEY+'-cloud';const legacyMeta=JSON.parse(localStorage.getItem(LEGACY_KEY+'-cloud')||'{}');if(!localStorage.getItem(KEY)&&legacyMeta.owner===user.id){const old=localStorage.getItem(LEGACY_KEY);if(old)localStorage.setItem(KEY,old);localStorage.setItem(SYNC_KEY,JSON.stringify(legacyMeta))}const data=localStorage.getItem(KEY);if(data)state=normalize(JSON.parse(data));syncMeta=JSON.parse(localStorage.getItem(SYNC_KEY)||'{}');accountReady=true;}else{KEY=LEGACY_KEY+'-signed-out';SYNC_KEY=KEY+'-cloud';}}catch(e){storageBlocked=true;syncLabel('Account storage could not be read · import a backup');}
 document.body.dataset.account=user?'signed-in':'signed-out';$('foodDialog').close();editingFood=null;render();if(!user)switchTab('settings');window.onWfwAccount?.(user);
}
function canonical(data){return JSON.stringify(normalize(data))}
function persistSync(){localStorage.setItem(SYNC_KEY,JSON.stringify(syncMeta))}
function syncLabel(message){$('syncStatus').textContent=message;$('networkStatus').textContent=message}
function syncChanged(){clearTimeout(syncTimer);syncLabel(cloudUser?'Changes pending':'Local only · sign in to sync');syncTimer=setTimeout(syncNow,800)}
window.nutritionChanged=syncChanged;
function showConflict(row){cloudConflict=row;$('syncConflict').hidden=false;syncLabel('Two copies differ · choose in Settings');$('conflictDetail').textContent=`Cloud saved ${new Date(row.updated_at).toLocaleString()}. Neither copy has been replaced. Export this device’s backup before choosing.`}
function acceptCloud(row){const next=normalize(row.payload);localStorage.setItem(KEY+'-before-cloud',JSON.stringify(state));localStorage.setItem(KEY,JSON.stringify(next));state=next;syncMeta={owner:cloudUser.id,revision:row.revision,base:canonical(next),lastSync:row.updated_at};persistSync();render();window.wfwAfterCloud?.()}
async function syncNow(){
 if(syncBusy||cloudConflict||recoveryPending||recoveryUserId)return;
 if(storageBlocked){syncLabel('Sync paused · reload or recover device storage');return}
 if(!cloudUser){syncLabel('Local only · sign in to sync');return}
 if(syncMeta.owner&&syncMeta.owner!==cloudUser.id){syncLabel('This device belongs to another account · sign out and use the original account');return}
 if(!navigator.onLine){syncLabel('Offline · changes stay on this device');return}
 syncBusy=true;
 try {
  syncLabel('Syncing…');const userId=cloudUser.id,generation=accountGeneration;
  const {data:row,error}=await cloud.from('nutrition_state').select('*').eq('user_id',userId).maybeSingle();if(error)throw error;
  if(storageBlocked||cloudUser?.id!==userId||generation!==accountGeneration)return;
  const current=canonical(state),remote=row?canonical(row.payload):null;
  const dirty=syncMeta.base?current!==syncMeta.base:current!==canonical(newAccountState());
  if(row&&current===remote){syncMeta={owner:userId,revision:row.revision,base:current,lastSync:row.updated_at};persistSync()}
  else if(row&&!dirty){acceptCloud(row)}
  else if(row&&(syncMeta.revision!==row.revision||!syncMeta.base)){showConflict(row);return}
  else {
   // Persist account binding before uploading; another account must never inherit these records.
   syncMeta.owner=userId;persistSync();
   const {data:saved,error:writeError}=await cloud.rpc('nutrition_save',{expected_revision:row?.revision||0,next_payload:JSON.parse(current)});
   if(writeError)throw writeError;if(cloudUser?.id!==userId||generation!==accountGeneration)return;
   syncMeta={owner:userId,revision:saved.revision,base:current,lastSync:saved.updated_at};persistSync();
  }
  if(canonical(state)!==syncMeta.base){syncLabel('Changes pending');syncTimer=setTimeout(syncNow,800)}
  else syncLabel('Synced · '+new Date(syncMeta.lastSync).toLocaleString());
 }catch(error){syncLabel(error.code==='40001'?'Newer cloud copy · tap Sync now to review':'Not synced · '+(error.message||'connection failed')+' · Retry');}
 finally{syncBusy=false}
}
$('syncNow').onclick=()=>{cloudConflict=null;$('syncConflict').hidden=true;syncNow()};
$('useCloud').onclick=()=>{if(!cloudConflict||syncBusy)return;if(!confirm('Replace this device’s records with the cloud copy? A recovery copy will be kept on this device.'))return;try{acceptCloud(cloudConflict);cloudConflict=null;$('syncConflict').hidden=true;syncNow()}catch(e){syncLabel('Could not keep a recovery copy: '+e.message)}};
$('useDevice').onclick=()=>{if(!cloudConflict||syncBusy)return;if(!confirm('Replace the cloud records with this device’s complete copy? This affects your other devices too.'))return;try{localStorage.setItem(KEY+'-cloud-before-replace',JSON.stringify(cloudConflict.payload));syncMeta={owner:cloudUser.id,revision:cloudConflict.revision,base:canonical(cloudConflict.payload),lastSync:cloudConflict.updated_at};persistSync();cloudConflict=null;$('syncConflict').hidden=true;syncNow()}catch(e){syncLabel('Could not keep a recovery copy: '+e.message)}};
$('authForm').onsubmit=async event=>{
 event.preventDefault();const action=event.submitter?.value||'signin';$('authMessage').textContent='Connecting…';
 const credentials={email:$('authEmail').value.trim(),password:$('authPassword').value};
 try{const result=action==='signup'?await cloud.auth.signUp({...credentials,options:{emailRedirectTo:'https://lgdghub.github.io/Personal_IOS_NutritionTracker/'}}):await cloud.auth.signInWithPassword(credentials);if(result.error)throw result.error;$('authPassword').value='';$('authMessage').textContent=action==='signup'&&!result.data.session?'Check your email and confirm your account, then return here to sign in.':'Signed in.'}catch(e){$('authMessage').textContent=e.message}
};
$('signOut').onclick=async()=>{if(syncBusy){toast('Wait for the current sync to finish.');return}await window.wfwBeforeSignOut?.();const {error}=await cloud.auth.signOut({scope:'local'});if(error)$('authMessage').textContent=error.message};
cloud.auth.onAuthStateChange((_event,session)=>{
 const previous=cloudUser?.id;cloudUser=session?.user||null;if(_event==='INITIAL_SESSION'||previous!==cloudUser?.id)selectAccount(cloudUser);
 if(_event==='INITIAL_SESSION'&&!cloudUser&&recoveryPending){recoveryPending=false;switchTab('settings');$('passwordReset').open=true;$('resetEmailMessage').textContent='This reset link could not be verified. Request a new email and open its newest link.';}
 if(_event==='SIGNED_OUT')recoveryPending=false;
 if(_event==='PASSWORD_RECOVERY'&&cloudUser){recoveryPending=false;recoveryUserId=cloudUser.id;try{sessionStorage.setItem('wfw-password-recovery',recoveryUserId)}catch{}}
 if(!cloudUser||recoveryUserId&&recoveryUserId!==cloudUser.id){recoveryUserId=null;try{sessionStorage.removeItem('wfw-password-recovery')}catch{}}
 $('newPasswordForm').hidden=!recoveryUserId;
 if(recoveryUserId){switchTab('settings');window.scrollTo({top:0,behavior:'instant'});syncLabel('Choose your new password to finish recovery');}
 if(cloudUser&&!$('resetEmail').value)$('resetEmail').value=cloudUser.email||'';
$('authForm').hidden=!!cloudUser;$('signOut').hidden=!cloudUser;$('syncNow').hidden=!cloudUser;$('cloudAccount').textContent=cloudUser?'Signed in as '+cloudUser.email:'Create a Personal WFW Tracker login. This is separate from your Supabase dashboard account.';
 cloudConflict=null;$('syncConflict').hidden=true;
 // Run outside the auth callback to avoid waiting on the SDK's auth lock.
 setTimeout(syncNow,0);
});
window.addEventListener('online',syncNow);window.addEventListener('offline',()=>syncLabel('Offline · changes stay on this device'));
window.addEventListener('focus',syncNow);document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncNow()});
setInterval(()=>{if(!document.hidden)syncNow()},30000);

$('resetEmailForm').onsubmit=async event=>{
 event.preventDefault();if($('sendResetEmail').disabled)return;
 const email=$('resetEmail').value.trim();if(!email||!$('resetEmail').checkValidity()){$('resetEmail').reportValidity();return}
 $('sendResetEmail').disabled=true;$('resetEmailMessage').textContent='Sending reset request…';
 try{const {error}=await cloud.auth.resetPasswordForEmail(email,{redirectTo:resetReturnURL});if(error)throw error;$('resetEmailMessage').textContent='If an account exists for this email, you’ll receive a password reset link. Check your inbox and spam folder. Open the newest link.'}
 catch(e){$('resetEmailMessage').textContent='Could not request a reset: '+e.message+' Please try again later.'}
 finally{$('sendResetEmail').disabled=false}
};
$('newPasswordForm').onsubmit=async event=>{
 event.preventDefault();if($('saveNewPassword').disabled)return;
 if(!cloudUser||recoveryUserId!==cloudUser.id){$('newPasswordMessage').textContent='Open a valid password reset email link first.';return}
 const password=$('newPassword').value;
 if(password.length<8){$('newPasswordMessage').textContent='Use at least 8 characters.';return}
 if(password!==$('confirmPassword').value){$('newPasswordMessage').textContent='The passwords don’t match. Please enter them again.';return}
 $('saveNewPassword').disabled=true;$('newPasswordMessage').textContent='Saving your password…';
 try{const {error}=await cloud.auth.updateUser({password});if(error)throw error;
  $('newPassword').value='';$('confirmPassword').value='';recoveryUserId=null;recoveryPending=false;try{sessionStorage.removeItem('wfw-password-recovery')}catch{}
  $('newPasswordForm').hidden=true;$('newPasswordMessage').textContent='';$('authMessage').textContent='Password updated. Use your new password next time you sign in.';toast('Password updated successfully.');syncNow();
 }catch(e){$('newPasswordMessage').textContent='Password was not changed: '+e.message+' If your link expired, request a new reset email.'}
 finally{$('saveNewPassword').disabled=false}
};
// Supabase returns expired/used link errors in the URL. Do not display token values.
const recoveryError=new URLSearchParams(location.hash?.slice(1)||'').has('error')||new URLSearchParams(location.search||'').has('error');
if(recoveryError){recoveryPending=false;switchTab('settings');$('passwordReset').open=true;$('resetEmailMessage').textContent='This email link is invalid or has expired. Request a new password reset email below.';}
