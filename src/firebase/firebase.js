import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

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