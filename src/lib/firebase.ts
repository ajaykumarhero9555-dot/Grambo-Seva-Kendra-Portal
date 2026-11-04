import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyC5gz8dcJ2eTwVoJI8uGxqbKNrWTsDVZyw",
  authDomain: "girembo-sewa-kendra-598ed.firebaseapp.com",
  projectId: "girembo-sewa-kendra-598ed",
  storageBucket: "girembo-sewa-kendra-598ed.firebasestorage.app",
  messagingSenderId: "427828551511",
  appId: "1:427828551511:web:1fc038a196a9a64bb4e812",
  measurementId: "G-3KCTXPVMZ5",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export let analytics: ReturnType<typeof getAnalytics> | null = null;

isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  })
  .catch(() => {});

export default app;
