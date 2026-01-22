// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔴 นำค่าจาก Firebase Console มาแปะทับตรงนี้
  const firebaseConfig = {
    apiKey: "AIzaSyD3o8PaiYS1dvcR3_Pb1oOW8CC2ts7Fb94",
    authDomain: "slipwake-online-41716.firebaseapp.com",
    projectId: "slipwake-online-41716",
    storageBucket: "slipwake-online-41716.firebasestorage.app",
    messagingSenderId: "911451128540",
    appId: "1:911451128540:web:e9bdbaa623c65e2c06aa19",
    measurementId: "G-LQBW18M9FW"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app); // ✅ สร้างตัวแปร db

// ✅ Export db ออกไปด้วย
export { auth, googleProvider, db, signInWithPopup, signOut };

// ฟังก์ชัน Login/Logout (คงเดิมไว้)
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error(error);
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
  }
};