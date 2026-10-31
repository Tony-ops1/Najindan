// NajinDan: Firebase Google prijava + zasebni podatki v Firestore.
// Povezava zahteva nastavljeno firebase-config.js in pravila firestore.rules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDocFromServer, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

export function startAuth({ config, onLogin, onLogout, onError, onStatus }) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  auth.languageCode = 'sl';
  let generation = 0;

  onAuthStateChanged(auth, async (user) => {
    const current = ++generation;
    if (!user) {
      onLogout();
      return;
    }
    onStatus('Varno nalagam vajino poroko iz oblaka …');
    const ref = doc(db, 'users', user.uid, 'weddings', 'main');
    try {
      const snapshot = await getDocFromServer(ref);
      if (current !== generation || auth.currentUser?.uid !== user.uid) return;
      const plan = snapshot.exists() ? snapshot.data().plan : null;
      await onLogin(user, plan, async updatedPlan => {
        // Strežnik zahteva prijavo in preveri uporabnikov UID v Firestore pravilih.
        await setDoc(ref, { plan: updatedPlan, updatedAt: serverTimestamp() });
      });
    } catch (error) {
      if (current === generation) onError(error);
    }
  }, onError);

  async function login() {
    // Default remains the verified Firebase flow. The combined flow must only
    // be enabled after the Drive OAuth app is public and safelisted in Firebase.
    if (config.unifiedGoogleDriveLogin !== true) return signInWithPopup(auth, provider);
    const gallery = window.NAJINDAN_DRIVE_GALLERY;
    if (!gallery?.requestLoginToken || !gallery?.adoptLoginToken) {
      throw new Error('Združena prijava še ni pripravljena. Osveži stran.');
    }
    const googleToken = await gallery.requestLoginToken();
    // Firebase verifies the Google credential; no client secret is sent to the browser.
    const credential = GoogleAuthProvider.credential(null, googleToken.access_token);
    const result = await signInWithCredential(auth, credential);
    // A temporarily unavailable Drive API must not block an already valid Firebase login.
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
    logout: () => signOut(auth)
  };
}
