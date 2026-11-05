import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCrRKehfrM-rocQXJZkCWYSWu9svKHlnoY",
  authDomain: "cityecomap.firebaseapp.com",
  projectId: "cityecomap",
  storageBucket: "cityecomap.firebasestorage.app",
  messagingSenderId: "774663597426",
  appId: "1:774663597426:web:e7ff0cbd018dfbad5041eb"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Local testing only: connects to the Firebase Emulator Suite when the dev server
// is started with REACT_APP_USE_EMULATOR=true on localhost. Never set this for
// production builds.
if (
  process.env.REACT_APP_USE_EMULATOR === "true" &&
  window.location.hostname === "localhost"
) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  console.warn("[EMULATOR MODE] Firestore and Auth are connected to the local emulator.");
}