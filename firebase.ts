import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBj2RJvbWLR1jx8PfWCqaCNezWJaSA-3sY",
  authDomain: "elmghrabyelectric.firebaseapp.com",
  databaseURL: "https://elmghrabyelectric-default-rtdb.firebaseio.com",
  projectId: "elmghrabyelectric",
  storageBucket: "elmghrabyelectric.firebasestorage.app",
  messagingSenderId: "132688215967",
  appId: "1:132688215967:web:483d64a3e60c92780c87aa"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
