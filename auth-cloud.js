// NajinDan: Firebase Google prijava + zasebni podatki v Firestore.
// Povezava zahteva nastavljeno firebase-config.js in pravila firestore.rules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { startCoupleSharing } from './couple-share.js';

export function startAuth({ config, onLogin, onLogout, onError, onStatus, onRemotePlan, onSyncError }) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  auth.languageCode = 'sl';
  let generation = 0;

  const sharing = startCoupleSharing({ db, auth, onLogin, onRemotePlan, onStatus, onError, onSyncError });
  onAuthStateChanged(auth, async (user) => {
    const current = ++generation;
    if (!user) {
      sharing.stop();
      onLogout();
      return;
    }
    onStatus('Varno nalagam vajino poroko iz oblaka …');
    try {
      await sharing.open(user);
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
    logout: () => signOut(auth),
    sharing
  };
}
