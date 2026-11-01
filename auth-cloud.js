// NajinDan: Firebase Google prijava + zasebni podatki v Firestore.
// Osebna prijava mora delovati tudi preden so objavljena pravila za skupno poroko.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDocFromServer, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

export function startAuth({ config, onLogin, onLogout, onError, onStatus, onRemotePlan, onSyncError }) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  auth.languageCode = 'sl';
  let generation = 0;
  let sharing = null;

  onAuthStateChanged(auth, async (user) => {
    const current = ++generation;
    if (!user) {
      sharing?.stop();
      onLogout();
      return;
    }
    onStatus('Varno nalagam vajino poroko iz oblaka …');
    try {
      if (config.coupleSharingEnabled === true) {
        // Shared-mode module is OPTIONAL: never import it for ordinary logins.
        // Activate only after the matching Firestore rules are deployed.
        const { startCoupleSharing } = await import('./couple-share.js');
        if (current !== generation || auth.currentUser?.uid !== user.uid) return;
        if (!sharing) sharing = startCoupleSharing({
          db, auth, onLogin, onRemotePlan, onStatus, onError, onSyncError
        });
        await sharing.open(user);
        return;
      }

      // Proven personal-login flow: no shared-pointer queries, no invites,
      // and no dependency on a separately loaded couple-sharing module.
      const ref = doc(db, 'users', user.uid, 'weddings', 'main');
      const snapshot = await getDocFromServer(ref);
      if (current !== generation || auth.currentUser?.uid !== user.uid) return;
      const plan = snapshot.exists() ? snapshot.data().plan : null;
      await onLogin(user, plan, async updatedPlan => {
        if (auth.currentUser?.uid !== user.uid) return;
        await setDoc(ref, { plan: updatedPlan, updatedAt: serverTimestamp() });
        return updatedPlan;
      }, { role: 'owner', ownerUid: user.uid });
    } catch (error) {
      if (current === generation) onError(error);
    }
  }, onError);

  async function login() {
    if (config.unifiedGoogleDriveLogin !== true) return signInWithPopup(auth, provider);
    const gallery = window.NAJINDAN_DRIVE_GALLERY;
    if (!gallery?.requestLoginToken || !gallery?.adoptLoginToken) {
      throw new Error('Združena prijava še ni pripravljena. Osveži stran.');
    }
    const googleToken = await gallery.requestLoginToken();
    const credential = GoogleAuthProvider.credential(null, googleToken.access_token);
    const result = await signInWithCredential(auth, credential);
    try {
      await gallery.adoptLoginToken(result.user, googleToken);
    } catch (error) {
      console.warn('NajinDan: Google Drive avtorizacija ni uspela', error);
    }
    return result;
  }

  return {
    login,
    loginWithoutDrive: () => signInWithPopup(auth, provider),
    logout: () => signOut(auth),
    get sharing() { return sharing; }
  };
}
