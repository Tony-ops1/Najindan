// NajinDan shared wedding. Publish matching firestore.rules before inviting.
import { doc, collection, getDocFromServer, getDocs, setDoc, deleteDoc,
  writeBatch, runTransaction, serverTimestamp, Timestamp, onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const copy = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const withIds = a => Array.isArray(a) && a.every(v=>object(v)&&typeof v.id==='string');

// Merge the user's differences against the latest server revision, not a stale
// whole-plan snapshot. Different guest rows/tasks/categories remain intact.
export function mergePlanChanges(base, edited, live) {
  if(eq(base,edited))return copy(live);
  if(withIds(base||[])&&withIds(edited)&&withIds(live||[])){
    const old=new Map((base||[]).map(v=>[v.id,v]));
    const next=new Map(edited.map(v=>[v.id,v]));
    const merged=(live||[]).filter(v=>next.has(v.id)||!old.has(v.id))
      .map(v=>next.has(v.id)?mergePlanChanges(old.get(v.id),next.get(v.id),v):v);
    const ids=new Set(merged.map(v=>v.id));
    for(const v of edited)if(!ids.has(v.id)){merged.push(copy(v));ids.add(v.id)}
    const original=(base||[]).map(v=>v.id);
    const reordered=edited.filter(v=>old.has(v.id)).map(v=>v.id);
    if(!eq(original,reordered)){
      const order=new Map(edited.map((v,i)=>[v.id,i]));
      merged.sort((a,b)=>(order.get(a.id)??9999)-(order.get(b.id)??9999));
    }
    return merged;
  }
  if(object(edited)&&(object(base)||base==null)&&(object(live)||live==null)){
    const result=copy(live||{}),old=base||{};
    for(const k of new Set([...Object.keys(old),...Object.keys(edited)])){
      if(!Object.prototype.hasOwnProperty.call(edited,k)){
        if(Object.prototype.hasOwnProperty.call(old,k))delete result[k];
      }else if(!eq(old[k],edited[k])){
        result[k]=mergePlanChanges(old[k],edited[k],result[k]);
      }
    }
    return result;
  }
  return copy(edited);
}
function parseInvite(code){
  const parts=/^([A-Za-z0-9_-]{8,128})\.([a-f0-9]{48})$/.exec(String(code||'').trim());
  if(!parts)throw Error('Povezava za povabilo ni veljavna.');
  return {ownerUid:parts[1],inviteId:parts[2]};
}
function randomId(){
  const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);
  return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function startCoupleSharing({db,auth,onLogin,onRemotePlan,onStatus,onError}){
  let unlisten=null,ref=null,ownerUid='',userUid='',gen=0;
  const userRef=(uid,...path)=>doc(db,'users',uid,...path);
  const signedIn=()=>{if(!auth.currentUser)throw Error('Najprej se prijavi z Googlom.');return auth.currentUser};
  const denied=e=>String(e?.code||'').includes('permission-denied');
  function stop(){
    gen++;if(unlisten)unlisten();unlisten=null;ref=null;ownerUid='';userUid='';
  }
  async function open(user){
    stop();const currentGen=gen,uid=user.uid;userUid=uid;
    let owner=uid;
    try{
      const link=await getDocFromServer(userRef(uid,'shared','main'));
      if(link.exists())owner=link.data().ownerUid;
    }catch(e){if(!denied(e))throw e} // Existing users work before new rules are deployed.
    if(currentGen!==gen||auth.currentUser?.uid!==uid)return;
    let wedding=userRef(owner,'weddings','main'),snap;
    try{snap=await getDocFromServer(wedding)}
    catch(e){
      if(owner===uid||!denied(e))throw e;
      // Revoked membership: keep the personal wedding, don't leak shared data.
      await deleteDoc(userRef(uid,'shared','main'));
      owner=uid;wedding=userRef(uid,'weddings','main');
      snap=await getDocFromServer(wedding);
    }
    if(currentGen!==gen||auth.currentUser?.uid!==uid)return;
    ref=wedding;ownerUid=owner;
    const plan=snap.exists()?snap.data().plan:null;
    const writer=async(edited,baseline)=>{
      if(auth.currentUser?.uid!==uid||ref!==wedding)return;
      await runTransaction(db,async tx=>{
        const latest=await tx.get(wedding);
        if(!latest.exists()&&owner!==uid)throw Error('Skupni načrt še ni ustvarjen.');
        const next=latest.exists()
          ?mergePlanChanges(baseline,edited,latest.data().plan)
          :copy(edited);
        tx.set(wedding,{plan:next,updatedAt:serverTimestamp()});
      });
    };
    await onLogin(user,plan,writer,{role:owner===uid?'owner':'partner',ownerUid:owner});
    if(currentGen!==gen||auth.currentUser?.uid!==uid)return;
    unlisten=onSnapshot(wedding,next=>{
      if(currentGen===gen&&next.exists()&&auth.currentUser?.uid===uid)
        onRemotePlan(next.data().plan,uid,owner);
    },async e=>{
      if(currentGen!==gen)return;
      if(owner!==uid&&denied(e)){
        onStatus('Dostop do skupne poroke je preklican. Nalagam osebni načrt …');
        try{await open(user)}catch(error){onError(error)}
      }else onError(e);
    });
  }
  async function createInvite(email,plan){
    const user=signedIn();
    if(ownerUid!==user.uid||!ref)throw Error('Partnerja lahko povabi lastnik načrta.');
    const address=String(email||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)||address.length>254)
      throw Error('Vpiši pravilen Google e-poštni naslov.');
    if(address===String(user.email||'').toLowerCase())throw Error('Ne moreš povabiti samega sebe.');
    const members=await getDocs(collection(db,'users',user.uid,'members'));
    if(!members.empty)throw Error('Ta načrt že ima povezanega partnerja.');
    const current=await getDocFromServer(ref);
    if(!current.exists())await setDoc(ref,{plan:copy(plan),updatedAt:serverTimestamp()});
    const inviteId=randomId();
    await setDoc(userRef(user.uid,'invites',inviteId),{
      email:address,createdAt:serverTimestamp(),
      expiresAt:Timestamp.fromDate(new Date(Date.now()+6*86400000))
    });
    const link=new URL(location.pathname,location.origin);
    link.searchParams.set('invite',user.uid+'.'+inviteId);
    return {email:address,link:link.href};
  }
  async function acceptInvite(code){
    const user=signedIn();
    if(!user.emailVerified)throw Error('Googlov e-poštni naslov mora biti potrjen.');
    const {ownerUid:owner,inviteId}=parseInvite(code);
    if(owner===user.uid)throw Error('To je tvoje povabilo. Posreduj ga partnerju.');
    let invite;
    try{invite=await getDocFromServer(userRef(owner,'invites',inviteId))}
    catch(e){
      if(denied(e))throw Error('Povabilo ni za ta račun ali pravila skupne poroke še niso objavljena.');
      throw e;
    }
    if(!invite.exists())throw Error('Povabilo ne obstaja več.');
    const info=invite.data();
    if(info.email!==String(user.email||'').toLowerCase())throw Error('Povabilo velja za drug Google račun.');
    if(!info.expiresAt||info.expiresAt.toMillis()<Date.now())throw Error('Povabilo je poteklo.');
    const personalPointer=await getDocFromServer(userRef(user.uid,'shared','main'));
    if(personalPointer.exists())throw Error('Že si povezan s skupno poroko.');
    const batch=writeBatch(db);
    batch.set(userRef(owner,'members',user.uid),{
      email:String(user.email).toLowerCase(),inviteId,joinedAt:serverTimestamp()
    });
    batch.set(userRef(user.uid,'shared','main'),{ownerUid:owner,joinedAt:serverTimestamp()});
    await batch.commit();
    await open(user);
  }
  async function members(){
    const user=signedIn();
    if(ownerUid!==user.uid)return [];
    const found=await getDocs(collection(db,'users',user.uid,'members'));
    return found.docs.map(d=>({uid:d.id,email:d.data().email}));
  }
  async function removeMember(uid){
    const user=signedIn();
    if(ownerUid!==user.uid)throw Error('To lahko naredi samo lastnik poroke.');
    await deleteDoc(userRef(user.uid,'members',uid));
  }
  async function leave(){
    const user=signedIn();
    if(ownerUid===user.uid)throw Error('Lastnik ne more zapustiti svoje poroke.');
    await deleteDoc(userRef(ownerUid,'members',user.uid));
    await deleteDoc(userRef(user.uid,'shared','main'));
    await open(user);
  }
  return {open,stop,createInvite,acceptInvite,members,removeMember,leave};
}
