// NajinDan: Firebase Google prijava + zasebni podatki v Firestore.
// Povezava zahteva nastavljeno firebase-config.js in pravila firestore.rules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
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

  return {
    login: () => signInWithPopup(auth, provider),
    logout: () => signOut(auth)
  };
}
