export function reminders(settings,state,now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const hour=Number(parts.hour),date=`${parts.year}-${parts.month}-${parts.day}`;
 if(hour<settings.start_hour||hour>=settings.end_hour)return [];
 const result=[],d=state.days?.[date],goal=d?.goals?.water??state.settings?.goals?.water,logged=d?.waterRecorded?d.water:0,left=Math.round((goal-logged)*100)/100;
 if(settings.water_enabled&&left>0&&Number.isFinite(left))result.push({kind:'water',key:date+':'+Math.floor((hour*60+Number(parts.minute)-settings.start_hour*60)/settings.interval_minutes),body:`${left}L left towards your ${goal}L water target, based on your last sync${d?.waterRecorded?'':'; no water logged today'}.`});
 if(settings.stock_enabled)for(const [id,v] of Object.entries(state.supplementStock||{})){const ticks=Object.values(state.days||{}).filter(d=>d.supplements?.[id]).length,left=Math.round((v.balance-v.dose*(ticks-v.anchorCount))*100)/100;if(left<=v.threshold)result.push({kind:'stock',key:id+':'+v.cycle,body:`Time to reorder ${({creatine:'creatine',vitd:'vitamin D3',omega:'omega-3',mag:'magnesium'})[id]||'your supplement'}: ${left} ${v.unit} left based on your last sync.`})}
 return result;
}
export function validSubscription(s){try{const u=new URL(s.endpoint),host=u.hostname;return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443')&&(host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host==='web.push.apple.com'||host.endsWith('.notify.windows.com'))&&/^[A-Za-z0-9_-]{80,100}={0,2}$/.test(s.keys.p256dh)&&/^[A-Za-z0-9_-]{20,30}={0,2}$/.test(s.keys.auth)}catch{return false}}
