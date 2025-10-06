// ===================================================================
// Firebase 設定ファイル
// プロジェクト: forums-app-6891f
// ===================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase設定情報（あなたのプロジェクト）
const firebaseConfig = {
  apiKey: "AIzaSyCqBIJy19f5nuH0rnws_tU-cFbw-lUx_ko",
  authDomain: "forums-app-6891f.firebaseapp.com",
  projectId: "forums-app-6891f",
  storageBucket: "forums-app-6891f.firebasestorage.app",
  messagingSenderId: "840866364881",
  appId: "1:840866364881:web:4ed3f6e03dea6285edf4f0"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);

// 認証の永続化設定（リロードしてもログイン状態を維持）
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('%c Firebase Authentication: セッション永続化を設定しました', 'color: #4CAF50; font-weight: bold');
  })
  .catch((error) => {
    console.error('セッション永続化エラー:', error);
  });

// Firestore初期化
const db = getFirestore(app);

console.log('%c Firebase初期化完了: forums-app-6891f', 'color: #4CAF50; font-weight: bold; font-size: 14px');

// エクスポート
export { auth, db };
