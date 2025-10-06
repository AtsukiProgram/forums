// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// あなたのFirebaseプロジェクト設定
const firebaseConfig = {
  apiKey: "AIzaSyCqBIJy19f5nuH0rnws_tU-cFbw-lUx_ko",
  authDomain: "forums-app-6891f.firebaseapp.com",
  projectId: "forums-app-6891f",
  storageBucket: "forums-app-6891f.firebasestorage.app",
  messagingSenderId: "840866364881",
  appId: "1:840866364881:web:4ed3f6e03dea6285edf4f0"
};

// Firebase初期化・サービスエクスポート
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
