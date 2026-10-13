'use strict';
// Only a public client key belongs here. Row-level security protects every record.
const cloud = supabase.createClient('https://zrtnabwryzbdqzwghxcp.supabase.co','sb_publishable_qKmHecgEm6v5_-WJR0ib_Q_G7gwbWmq');
const SYNC_KEY=KEY+'-cloud';
let syncMeta={},cloudUser=null,syncBusy=false,syncTimer,cloudConflict=null;
try {syncMeta=JSON.parse(localStorage.getItem(SYNC_KEY)||'{}')} catch {storageBlocked=true}
function canonical(data){return JSON.stringify(normalize(data))}
function persistSync(){localStorage.setItem(SYNC_KEY,JSON.stringify(syncMeta))}
function syncLabel(message){$('syncStatus').textContent=message;$('networkStatus').textContent=message}
function syncChanged(){clearTimeout(syncTimer);syncLabel(cloudUser?'Changes pending':'Local only · sign in to sync');syncTimer=setTimeout(syncNow,800)}
window.nutritionChanged=syncChanged;
function showConflict(row){cloudConflict=row;$('syncConflict').hidden=false;syncLabel('Two copies differ · choose in Settings');$('conflictDetail').textContent=`Cloud saved ${new Date(row.updated_at).toLocaleString()}. Neither copy has been replaced. Export this device’s backup before choosing.`}
function acceptCloud(row){const next=normalize(row.payload);localStorage.setItem(KEY+'-before-cloud',JSON.stringify(state));localStorage.setItem(KEY,JSON.stringify(next));state=next;syncMeta={owner:cloudUser.id,revision:row.revision,base:canonical(next),lastSync:row.updated_at};persistSync();render()}
async function syncNow(){
 if(syncBusy||cloudConflict)return;
 if(storageBlocked){syncLabel('Sync paused · reload or recover device storage');return}
 if(!cloudUser){syncLabel('Local only · sign in to sync');return}
 if(syncMeta.owner&&syncMeta.owner!==cloudUser.id){syncLabel('This device belongs to another account · sign out and use the original account');return}
 if(!navigator.onLine){syncLabel('Offline · changes stay on this device');return}
 syncBusy=true;
 try {
  syncLabel('Syncing…');const userId=cloudUser.id;
  const {data:row,error}=await cloud.from('nutrition_state').select('*').eq('user_id',userId).maybeSingle();if(error)throw error;
  if(storageBlocked||cloudUser?.id!==userId)return;
  const current=canonical(state),remote=row?canonical(row.payload):null;
  const dirty=syncMeta.base?current!==syncMeta.base:current!==canonical(freshState());
  if(row&&current===remote){syncMeta={owner:userId,revision:row.revision,base:current,lastSync:row.updated_at};persistSync()}
  else if(row&&!dirty){acceptCloud(row)}
  else if(row&&(syncMeta.revision!==row.revision||!syncMeta.base)){showConflict(row);return}
  else {
   // Persist account binding before uploading; another account must never inherit these records.
   syncMeta.owner=userId;persistSync();
   const {data:saved,error:writeError}=await cloud.rpc('nutrition_save',{expected_revision:row?.revision||0,next_payload:JSON.parse(current)});
   if(writeError)throw writeError;
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
$('signOut').onclick=async()=>{if(syncBusy){toast('Wait for the current sync to finish.');return}const {error}=await cloud.auth.signOut({scope:'local'});if(error)$('authMessage').textContent=error.message};
cloud.auth.onAuthStateChange((_event,session)=>{
 cloudUser=session?.user||null;$('authForm').hidden=!!cloudUser;$('signOut').hidden=!cloudUser;$('syncNow').hidden=!cloudUser;$('cloudAccount').textContent=cloudUser?'Signed in as '+cloudUser.email:'Create a Nutrition OS login. This is separate from your Supabase dashboard account.';
 cloudConflict=null;$('syncConflict').hidden=true;
 // Run outside the auth callback to avoid waiting on the SDK's auth lock.
 setTimeout(syncNow,0);
});
window.addEventListener('online',syncNow);window.addEventListener('offline',()=>syncLabel('Offline · changes stay on this device'));
window.addEventListener('focus',syncNow);document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncNow()});
setInterval(()=>{if(!document.hidden)syncNow()},30000);
