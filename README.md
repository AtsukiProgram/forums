# Forums - フォーラムWebアプリケーション

Firebase統合の完全なフォーラムWebサイトです。

## セットアップ手順

### 1. Firebase設定
1. Firebase Consoleで新しいプロジェクトを作成
2. Authentication（メール/パスワード）を有効化
3. Cloud Firestoreを有効化
4. Firestore Security Rulesを設定
5. firebase-config.jsの設定情報を更新

### 2. Firestore Security Rules
Firebaseコンソールの「Firestore Database」→「ルール」タブで以下を設定：

\\\
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    match /threads/{threadId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        (resource.data.creatorId == request.auth.uid || 
         get(/databases//documents/users/).data.isAdmin == true);
    }
    match /messages/{messageId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.userId;
    }
    match /replies/{replyId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.userId;
    }
  }
}
\\\

### 3. ローカルテスト
HTTPサーバーで実行してください：

\\\ash
# Python 3を使用
python -m http.server 8000

# Node.jsを使用
npx http-server
\\\

ブラウザで http://localhost:8000 にアクセス

### 4. GitHub Pagesデプロイ
1. GitHubリポジトリを作成
2. ファイルをプッシュ
3. Settings → Pages → Source: main branch
4. 公開URLにアクセス

### 5. Firebase Hostingデプロイ
\\\ash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
\\\

## 機能

- ユーザー認証（登録・ログイン・ログアウト・削除）
- スレッド作成・検索・ソート
- メッセージ投稿・いいね・返信
- 管理者機能（固定・ロック・削除）
- リアルタイム同期
- セッション永続化

## 管理者アカウント

ユーザー名「AtsukiGames」で登録すると自動的に管理者権限が付与されます。

## 技術スタック

- HTML5 / CSS3 / JavaScript (ES6+)
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting

## ライセンス

MIT License
