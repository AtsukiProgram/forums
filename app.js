// ===================================================================
// Forums アプリケーション - 修正版メインロジック（全要求事項対応）
// ===================================================================

import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    deleteUser, 
    updateProfile 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    getDoc, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    where, 
    onSnapshot, 
    Timestamp, 
    setDoc, 
    increment 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===================================================================
// グローバル状態管理
// ===================================================================
let currentUser = null;
let currentUserData = null;
let currentThread = null;
let currentMessage = null;
let currentSort = 'new';
let searchQuery = '';
let threadsUnsubscribe = null;
let messagesUnsubscribe = null;
let repliesUnsubscribe = null;

// ===================================================================
// 初期化
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupAuthStateListener();
});

// ===================================================================
// 認証状態の監視
// ===================================================================
function setupAuthStateListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData(user.uid);
            updateUIForLoggedInUser();
        } else {
            currentUser = null;
            currentUserData = null;
            updateUIForLoggedOutUser();
        }
        setupRealtimeThreadsListener();
    });
}

async function loadUserData(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            currentUserData = { id: uid, ...userDoc.data() };
        }
    } catch (error) {
        currentUserData = null;
    }
}

// ===================================================================
// イベントリスナー設定（完全版）
// ===================================================================
function setupEventListeners() {
    // ロゴクリック - ホームに戻る
    document.getElementById('logoBtn').addEventListener('click', () => {
        searchQuery = '';
        currentSort = 'new';
        document.getElementById('searchInput').value = '';
        document.getElementById('sortLabel').textContent = '新規順';
        hideThreadDetail();
        hideReplyDetail();
        setupRealtimeThreadsListener();
    });

    // アカウント関連 - モーダル修正版
    document.getElementById('accountBtn').addEventListener('click', showAccountModal);

    // モーダルオーバーレイクリック時の処理を修正
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modalOverlay')) {
            hideAccountModal();
        }
    });

    // フォーム送信処理
    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    document.getElementById('registerFormElement').addEventListener('submit', handleRegister);

    // リンククリック時の処理を修正
    document.getElementById('showRegisterLink').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showRegisterForm();
    });
    document.getElementById('showLoginLink').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showLoginForm();
    });

    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('deleteAccountBtn').addEventListener('click', handleDeleteAccount);

    // スレッド作成モーダル
    document.getElementById('createThreadBtn').addEventListener('click', showCreateThreadModal);
    document.getElementById('createThreadOverlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('createThreadOverlay')) {
            hideCreateThreadModal();
        }
    });
    document.getElementById('cancelCreateBtn').addEventListener('click', hideCreateThreadModal);
    document.getElementById('createThreadForm').addEventListener('submit', handleCreateThread);
    document.getElementById('tagInput').addEventListener('keydown', handleTagInput);

    // 検索・ソート機能（▽修正版）
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('sortBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSortMenu();
    });

    // ソートオプション
    document.querySelectorAll('.sort-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSort(e.target.dataset.sort);
        });
    });

    // ドキュメント全体のクリックでメニューを閉じる
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.sort-dropdown')) {
            hideSortMenu();
        }
    });

    // スレッド詳細
    document.getElementById('backBtn').addEventListener('click', () => {
        hideThreadDetail();
        setupRealtimeThreadsListener();
    });
    document.getElementById('sendMessageBtn').addEventListener('click', handleSendMessage);

    // 返信機能
    document.getElementById('replyBackBtn').addEventListener('click', () => {
        hideReplyDetail();
        showThreadDetail(currentThread);
    });
    document.getElementById('sendReplyBtn').addEventListener('click', handleSendReply);

    // スレッド作成保護チェック
    const check = document.getElementById('protectThreadCheck');
    const group = document.getElementById('protectPasswordGroup');
    if (check && group) {
        check.addEventListener('change', function() {
            group.classList.toggle('hidden', !check.checked);
        });
    }

    // 管理メニュー
    document.getElementById('threadMenuBtn').addEventListener('click', () => {
        document.getElementById('threadMenu').classList.toggle('hidden');
    });
    document.getElementById('pinThreadBtn').addEventListener('click', pinThread);
    document.getElementById('lockThreadBtn').addEventListener('click', lockThread);
    document.getElementById('deleteThreadBtn').addEventListener('click', deleteThread);

    // パスワードモーダル
    document.getElementById('passwordOverlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('passwordOverlay')) {
            hidePasswordModal();
        }
    });
    document.getElementById('cancelPasswordBtn').addEventListener('click', hidePasswordModal);
    document.getElementById('passwordForm').addEventListener('submit', handlePasswordSubmit);
}

// ===================================================================
// UI状態更新
// ===================================================================
function updateUIForLoggedInUser() {
    document.getElementById('createThreadBtn').classList.remove('hidden');
    document.getElementById('accountBtn').textContent = currentUserData?.username || 'ユーザー';
}

function updateUIForLoggedOutUser() {
    document.getElementById('createThreadBtn').classList.add('hidden');
    document.getElementById('accountBtn').textContent = 'アカウント';
    document.getElementById('messageInputContainer').classList.add('hidden');
    document.getElementById('replyInputContainer').classList.add('hidden');
}

// ===================================================================
// ソートメニュー（▽修正版）
// ===================================================================
function toggleSortMenu() {
    const menu = document.getElementById('sortMenu');
    const btn = document.getElementById('sortBtn');

    const isHidden = menu.classList.contains('hidden');

    if (isHidden) {
        menu.classList.remove('hidden');
        btn.classList.add('active');
    } else {
        hideSortMenu();
    }
}

function hideSortMenu() {
    const menu = document.getElementById('sortMenu');
    const btn = document.getElementById('sortBtn');

    menu.classList.add('hidden');
    btn.classList.remove('active');
}

function handleSort(sort) {
    currentSort = sort;

    const labels = {
        'new': '新規順',
        'popular': '人気順',
        'old': '古い順'
    };

    document.getElementById('sortLabel').textContent = labels[sort];
    hideSortMenu();

    setupRealtimeThreadsListener();
}

// ===================================================================
// スレッドリアルタイム監視（人気順スコア修正版）
// ===================================================================
function setupRealtimeThreadsListener() {
    if (threadsUnsubscribe) {
        threadsUnsubscribe();
    }

    let q = query(collection(db, 'threads'));

    // 基本のソート条件（人気順以外）
    switch (currentSort) {
        case 'new':
            q = query(q, orderBy('createdAt', 'desc'));
            break;
        case 'old':
            q = query(q, orderBy('createdAt', 'asc'));
            break;
        case 'popular':
            // 人気順は後でJavaScriptでソート
            break;
    }

    threadsUnsubscribe = onSnapshot(q, (querySnapshot) => {
        let threads = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // スコア計算: メッセージ数×1 + いいね数×10
            const score = (data.messageCount || 0) * 1 + (data.likeCount || 0) * 10;
            threads.push({ 
                id: doc.id, 
                ...data,
                popularityScore: score 
            });
        });

        // 人気順の場合はスコアでソート
        if (currentSort === 'popular') {
            threads.sort((a, b) => b.popularityScore - a.popularityScore);
        }

        // 検索フィルター
        if (searchQuery) {
            threads = threads.filter(thread => 
                thread.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                thread.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                thread.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        // ピン留めされたスレッドを上部に表示
        threads.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return 0;
        });

        displayThreads(threads);
    });
}

// ===================================================================
// スレッド表示（管理者・スレッド主権限対応）
// ===================================================================
async function displayThreads(threads) {
    const container = document.getElementById('threadsContainer');

    if (threads.length === 0) {
        container.innerHTML = '<p class="no-threads">スレッドがありません。</p>';
        return;
    }

    container.innerHTML = '';

    for (const thread of threads) {
        const card = document.createElement('div');
        card.className = 'thread-card' + (thread.isPinned ? ' pinned' : '') + (thread.isLocked ? ' locked' : '');

        let creatorName = 'Unknown';
        try {
            const creatorDoc = await getDoc(doc(db, 'users', thread.creatorId));
            if (creatorDoc.exists()) {
                creatorName = creatorDoc.data().username;
            }
        } catch (error) {
            // エラーハンドリング
        }

        const date = thread.createdAt?.toDate().toLocaleDateString('ja-JP');

        // 管理者・スレッド主の場合はパスワード表示
        const isAdminOrCreator = currentUserData?.isAdmin || currentUser?.uid === thread.creatorId;
        const passwordDisplay = (thread.hasPassword && isAdminOrCreator) ? ` | パスワード: ${thread.password || '設定済み'}` : '';

        // 管理者メニューボタン表示判定
        const showMenu = isAdminOrCreator;

        // スレッドいいね機能（修正）
        const isThreadLiked = thread.likedBy?.includes(currentUser?.uid);
        const threadLikeBtn = currentUser ? `
            <button class="thread-like-btn ${isThreadLiked ? 'liked' : ''}" onclick="toggleThreadLike('${thread.id}', event)">
                👍 ${thread.likeCount || 0}
            </button>
        ` : `<span>👍 ${thread.likeCount || 0}</span>`;

        card.innerHTML = `
            ${showMenu ? `
                <button class="thread-card-menu-btn" onclick="showThreadCardMenu('${thread.id}', event)">⋮</button>
                <div class="thread-card-menu hidden" id="threadCardMenu-${thread.id}">
                    <button class="menu-option" onclick="togglePin('${thread.id}')">${thread.isPinned ? '📌 ピン留め解除' : '📌 ピン留め'}</button>
                    <button class="menu-option" onclick="toggleLock('${thread.id}')">${thread.isLocked ? '🔓 ロック解除' : '🔒 ロック'}</button>
                    <button class="menu-option delete" onclick="deleteThreadFromCard('${thread.id}')">🗑️ 削除</button>
                </div>
            ` : ''}
            <div class="thread-header">
                <h3 class="thread-title">${escapeHtml(thread.title)}</h3>
                <div class="thread-meta">
                    作成者: ${escapeHtml(creatorName)} | ${date}${passwordDisplay}
                </div>
            </div>
            <div class="thread-content">${escapeHtml(thread.content)}</div>
            ${thread.tags && thread.tags.length > 0 ? `
                <div class="thread-tags">
                    ${thread.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="thread-status">
                ${thread.isPinned ? '<span class="status-badge pinned">📌 ピン留め</span>' : ''}
                ${thread.isLocked ? '<span class="status-badge locked">🔒 ロック済み</span>' : ''}
                ${thread.hasPassword ? '<span class="status-badge protected">🔐 保護済み</span>' : ''}
            </div>
            <div class="thread-stats">
                <span>💬 ${thread.messageCount || 0}</span>
                ${threadLikeBtn}
                <span>📊 ${thread.popularityScore || 0}</span>
            </div>
        `;

        card.addEventListener('click', (e) => {
            // メニューボタンクリック時はスレッド詳細を開かない
            if (e.target.closest('.thread-card-menu-btn') || e.target.closest('.thread-card-menu') || e.target.closest('.thread-like-btn')) {
                return;
            }

            // 管理者・スレッド主はパスワード入力不要
            if (thread.hasPassword && !isAdminOrCreator && !thread.passwordVerified) {
                showPasswordModal(thread);
            } else {
                showThreadDetail(thread);
            }
        });

        container.appendChild(card);
    }
}

// ===================================================================
// スレッドいいね機能（修正版）
// ===================================================================
async function toggleThreadLike(threadId, event) {
    event.stopPropagation(); // カードクリックイベントを防止

    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }

    try {
        const threadRef = doc(db, 'threads', threadId);
        const threadSnap = await getDoc(threadRef);

        if (!threadSnap.exists()) return;

        const threadData = threadSnap.data();
        const likedBy = threadData.likedBy || [];
        const isLiked = likedBy.includes(currentUser.uid);

        if (isLiked) {
            await updateDoc(threadRef, {
                likedBy: likedBy.filter(uid => uid !== currentUser.uid),
                likeCount: increment(-1)
            });
        } else {
            await updateDoc(threadRef, {
                likedBy: [...likedBy, currentUser.uid],
                likeCount: increment(1)
            });
        }
    } catch (error) {
        console.error('スレッドいいね処理エラー:', error);
    }
}

// ===================================================================
// スレッドカードメニュー機能
// ===================================================================
function showThreadCardMenu(threadId, event) {
    event.stopPropagation();

    // 全てのメニューを閉じる
    document.querySelectorAll('.thread-card-menu').forEach(menu => {
        menu.classList.add('hidden');
    });

    // 該当メニューを表示
    const menu = document.getElementById(`threadCardMenu-${threadId}`);
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

async function togglePin(threadId) {
    if (!currentUserData?.isAdmin) return;

    try {
        const threadRef = doc(db, 'threads', threadId);
        const threadSnap = await getDoc(threadRef);

        if (threadSnap.exists()) {
            const threadData = threadSnap.data();
            await updateDoc(threadRef, {
                isPinned: !threadData.isPinned
            });
        }
    } catch (error) {
        console.error('ピン留めエラー:', error);
    }
}

async function toggleLock(threadId) {
    if (!currentUserData?.isAdmin) return;

    try {
        const threadRef = doc(db, 'threads', threadId);
        const threadSnap = await getDoc(threadRef);

        if (threadSnap.exists()) {
            const threadData = threadSnap.data();
            await updateDoc(threadRef, {
                isLocked: !threadData.isLocked
            });
        }
    } catch (error) {
        console.error('ロックエラー:', error);
    }
}

async function deleteThreadFromCard(threadId) {
    if (!confirm('このスレッドを削除しますか？この操作は元に戻せません。')) return;

    try {
        // 関連するメッセージと返信も削除
        const messagesQuery = query(collection(db, 'messages'), where('threadId', '==', threadId));
        const messagesSnapshot = await getDocs(messagesQuery);

        const deletePromises = [];

        messagesSnapshot.forEach(async (messageDoc) => {
            // 返信も削除
            const repliesQuery = query(collection(db, 'replies'), where('messageId', '==', messageDoc.id));
            const repliesSnapshot = await getDocs(repliesQuery);

            repliesSnapshot.forEach((replyDoc) => {
                deletePromises.push(deleteDoc(replyDoc.ref));
            });

            deletePromises.push(deleteDoc(messageDoc.ref));
        });

        deletePromises.push(deleteDoc(doc(db, 'threads', threadId)));

        await Promise.all(deletePromises);
    } catch (error) {
        console.error('スレッド削除エラー:', error);
        alert('スレッドの削除に失敗しました。');
    }
}

// ===================================================================
// 認証処理（メールアドレス削除対応）
// ===================================================================
function showAccountModal() {
    if (currentUser) {
        showUserInfo();
    } else {
        showLoginForm();
    }
    document.getElementById('modalOverlay').classList.remove('hidden');
}

function hideAccountModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('userInfo').classList.add('hidden');

    // フォームをリセット
    document.getElementById('loginFormElement').reset();
    document.getElementById('registerFormElement').reset();

    // エラーメッセージを隠す
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('registerError').classList.add('hidden');
}

function showLoginForm() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('userInfo').classList.add('hidden');
}

function showRegisterForm() {
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('userInfo').classList.add('hidden');
}

function showUserInfo() {
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');

    document.getElementById('userDisplayName').textContent = currentUserData?.username || 'Unknown';
}

// ログイン処理（ユーザー名対応）
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        // ユーザー名からメールアドレスを検索
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', username));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showError(document.getElementById('loginError'), 'ユーザー名が見つかりません。');
            return;
        }

        const userDoc = querySnapshot.docs[0];
        const email = userDoc.data().email;

        await signInWithEmailAndPassword(auth, email, password);
        hideAccountModal();
    } catch (error) {
        showError(document.getElementById('loginError'), getErrorMessage(error.code));
    }
}

// 新規登録処理（メールアドレス自動生成）
async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;

    try {
        // ユーザー名の重複チェック
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', username));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            showError(document.getElementById('registerError'), 'このユーザー名は既に使用されています。');
            return;
        }

        // メールアドレスを自動生成
        const email = `${username}@forums.local`;

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: username });
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            username: username,
            email: email,
            createdAt: Timestamp.now(),
            isAdmin: false
        });
        hideAccountModal();
    } catch (error) {
        showError(document.getElementById('registerError'), getErrorMessage(error.code));
    }
}

// ログアウト処理
async function handleLogout() {
    try {
        await signOut(auth);
        hideAccountModal();
    } catch (error) {
        console.error('ログアウトエラー:', error);
    }
}

// アカウント削除処理
async function handleDeleteAccount() {
    if (!confirm('本当にアカウントを削除しますか？この操作は元に戻せません。')) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'users', currentUser.uid));
        await deleteUser(currentUser);
        hideAccountModal();
    } catch (error) {
        console.error('アカウント削除エラー:', error);
        alert('アカウントの削除に失敗しました。');
    }
}

// ===================================================================
// スレッド詳細表示（管理者メニュー表示対応）
// ===================================================================
function showThreadDetail(thread) {
    currentThread = thread;
    document.getElementById('threadsContainer').classList.add('hidden');
    document.getElementById('toolbar').classList.add('hidden');
    document.getElementById('threadDetail').classList.remove('hidden');

    document.getElementById('threadTitle').textContent = thread.title;
    document.getElementById('threadMeta').innerHTML = createThreadMetaHTML(thread);

    // 管理者権限チェック
    if (currentUserData?.isAdmin || currentUser?.uid === thread.creatorId) {
        document.getElementById('threadMenuBtn').classList.remove('hidden');
        updateThreadMenuButtons(thread);
    } else {
        document.getElementById('threadMenuBtn').classList.add('hidden');
    }

    // メッセージ入力欄の表示制御
    if (currentUser && !thread.isLocked) {
        document.getElementById('messageInputContainer').classList.remove('hidden');
    } else {
        document.getElementById('messageInputContainer').classList.add('hidden');
    }

    setupRealtimeMessagesListener(thread.id);
}

function hideThreadDetail() {
    document.getElementById('threadDetail').classList.add('hidden');
    document.getElementById('threadsContainer').classList.remove('hidden');
    document.getElementById('toolbar').classList.remove('hidden');

    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
}

// ===================================================================
// スレッド作成
// ===================================================================
function showCreateThreadModal() {
    document.getElementById('createThreadOverlay').classList.remove('hidden');
    document.getElementById('threadTitleInput').focus();
}

function hideCreateThreadModal() {
    document.getElementById('createThreadOverlay').classList.add('hidden');
    document.getElementById('createThreadForm').reset();
    document.getElementById('tagsContainer').innerHTML = '';
    document.getElementById('protectPasswordGroup').classList.add('hidden');
    document.getElementById('createThreadError').classList.add('hidden');
}

async function handleCreateThread(e) {
    e.preventDefault();

    if (!currentUser) {
        showError(document.getElementById('createThreadError'), 'ログインが必要です。');
        return;
    }

    const title = document.getElementById('threadTitleInput').value.trim();
    const content = document.getElementById('threadContentInput').value.trim();
    const tags = Array.from(document.getElementById('tagsContainer').children).map(pill => pill.dataset.tag);
    const isProtected = document.getElementById('protectThreadCheck').checked;
    const password = document.getElementById('protectPasswordInput').value;

    if (!title || !content) {
        showError(document.getElementById('createThreadError'), 'タイトルと内容は必須です。');
        return;
    }

    if (isProtected && !password) {
        showError(document.getElementById('createThreadError'), 'パスワード保護を選択した場合、パスワードは必須です。');
        return;
    }

    try {
        const threadData = {
            title: title,
            content: content,
            tags: tags,
            creatorId: currentUser.uid,
            createdAt: Timestamp.now(),
            messageCount: 0,
            likeCount: 0,
            likedBy: [],
            isPinned: false,
            isLocked: false,
            hasPassword: isProtected
        };

        if (isProtected) {
            threadData.password = password;
        }

        await addDoc(collection(db, 'threads'), threadData);
        hideCreateThreadModal();
    } catch (error) {
        showError(document.getElementById('createThreadError'), 'スレッドの作成に失敗しました。');
    }
}

// タグ入力処理
function handleTagInput(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const input = e.target;
        const tag = input.value.trim();

        if (!tag) return;

        const container = document.getElementById('tagsContainer');
        const currentTags = container.children.length;

        if (currentTags >= 5) {
            showError(document.getElementById('createThreadError'), 'タグは5つまで作成できます。');
            return;
        }

        const pill = document.createElement('div');
        pill.className = 'tag-pill';
        pill.dataset.tag = tag;
        pill.innerHTML = `
            ${escapeHtml(tag)}
            <button type="button" class="tag-remove">×</button>
        `;

        pill.querySelector('.tag-remove').onclick = () => {
            pill.remove();
            document.getElementById('createThreadError').classList.add('hidden');
        };

        container.appendChild(pill);
        input.value = '';
    }
}

// ===================================================================
// メッセージ管理（以下、既存のコードと同じ）
// ===================================================================
function setupRealtimeMessagesListener(threadId) {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }

    const q = query(
        collection(db, 'messages'),
        where('threadId', '==', threadId),
        orderBy('createdAt', 'asc')
    );

    messagesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const messages = [];
        querySnapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        displayMessages(messages);
    });
}

async function displayMessages(messages) {
    const container = document.getElementById('messagesContainer');

    if (messages.length === 0) {
        container.innerHTML = '<p class="no-threads">メッセージがありません。</p>';
        return;
    }

    container.innerHTML = '';

    for (const message of messages) {
        const card = document.createElement('div');
        card.className = 'message-card';
        card.innerHTML = await createMessageHTML(message, true);
        container.appendChild(card);
    }
}

async function createMessageHTML(message, showActions = true) {
    let authorName = 'Unknown';
    try {
        const authorDoc = await getDoc(doc(db, 'users', message.userId));
        if (authorDoc.exists()) {
            authorName = authorDoc.data().username;
        }
    } catch (e) {
        // エラーハンドリング
    }

    const date = message.createdAt?.toDate().toLocaleString('ja-JP');
    const isLiked = message.likedBy?.includes(currentUser?.uid);
    const canDelete = currentUser && (currentUser.uid === message.userId || currentUserData?.isAdmin);

    return `
        <div class="message-header">
            <span class="message-author">${escapeHtml(authorName)}</span>
            <span class="message-date">${date}</span>
        </div>
        <div class="message-content">${escapeHtml(message.content)}</div>
        ${showActions ? `
            <div class="message-actions">
                <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${message.id}')">
                    👍 ${message.likeCount || 0}
                </button>
                <button class="reply-btn" onclick="showReplyDetail(${JSON.stringify(message).replace(/"/g, '&quot;')})">
                    💬 返信 (${message.replyCount || 0})
                </button>
                ${canDelete ? `<button class="delete-btn" onclick="deleteMessage('${message.id}')">🗑️</button>` : ''}
            </div>
        ` : ''}
    `;
}

async function handleSendMessage() {
    if (!currentUser || !currentThread) return;

    const input = document.getElementById('messageInput');
    const content = input.value.trim();

    if (!content) return;

    try {
        await addDoc(collection(db, 'messages'), {
            threadId: currentThread.id,
            userId: currentUser.uid,
            content: content,
            createdAt: Timestamp.now(),
            likeCount: 0,
            replyCount: 0,
            likedBy: []
        });

        // スレッドのメッセージ数を増加
        await updateDoc(doc(db, 'threads', currentThread.id), {
            messageCount: increment(1)
        });

        input.value = '';
    } catch (error) {
        console.error('メッセージ送信エラー:', error);
    }
}

async function toggleLike(messageId) {
    if (!currentUser) return;

    try {
        const messageRef = doc(db, 'messages', messageId);
        const messageSnap = await getDoc(messageRef);

        if (!messageSnap.exists()) return;

        const messageData = messageSnap.data();
        const likedBy = messageData.likedBy || [];
        const isLiked = likedBy.includes(currentUser.uid);

        if (isLiked) {
            await updateDoc(messageRef, {
                likedBy: likedBy.filter(uid => uid !== currentUser.uid),
                likeCount: increment(-1)
            });
        } else {
            await updateDoc(messageRef, {
                likedBy: [...likedBy, currentUser.uid],
                likeCount: increment(1)
            });
        }
    } catch (error) {
        console.error('いいね処理エラー:', error);
    }
}

async function deleteMessage(messageId) {
    if (!confirm('このメッセージを削除しますか？')) return;

    try {
        await deleteDoc(doc(db, 'messages', messageId));

        // スレッドのメッセージ数を減少
        if (currentThread) {
            await updateDoc(doc(db, 'threads', currentThread.id), {
                messageCount: increment(-1)
            });
        }
    } catch (error) {
        console.error('メッセージ削除エラー:', error);
    }
}

// ===================================================================
// 返信機能
// ===================================================================
function showReplyDetail(message) {
    currentMessage = message;
    document.getElementById('threadDetail').classList.add('hidden');
    document.getElementById('replyDetail').classList.remove('hidden');

    document.getElementById('originalMessage').innerHTML = createMessageHTML(message, false);

    if (currentUser) {
        document.getElementById('replyInputContainer').classList.remove('hidden');
    }

    setupRealtimeRepliesListener(message.id);
}

function hideReplyDetail() {
    document.getElementById('replyDetail').classList.add('hidden');
    document.getElementById('replyInputContainer').classList.add('hidden');

    if (repliesUnsubscribe) {
        repliesUnsubscribe();
        repliesUnsubscribe = null;
    }
}

function setupRealtimeRepliesListener(messageId) {
    if (repliesUnsubscribe) {
        repliesUnsubscribe();
    }

    const q = query(
        collection(db, 'replies'),
        where('messageId', '==', messageId),
        orderBy('createdAt', 'asc')
    );

    repliesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const replies = [];
        querySnapshot.forEach((doc) => {
            replies.push({ id: doc.id, ...doc.data() });
        });
        displayReplies(replies);
    });
}

async function displayReplies(replies) {
    const container = document.getElementById('repliesContainer');

    if (replies.length === 0) {
        container.innerHTML = '<p class="no-threads">返信がありません。</p>';
        return;
    }

    container.innerHTML = '';

    for (const reply of replies) {
        const card = document.createElement('div');
        card.className = 'message-card';
        card.innerHTML = await createMessageHTML(reply, false);
        container.appendChild(card);
    }
}

async function handleSendReply() {
    if (!currentUser || !currentMessage) return;

    const input = document.getElementById('replyInput');
    const content = input.value.trim();

    if (!content) return;

    try {
        await addDoc(collection(db, 'replies'), {
            messageId: currentMessage.id,
            userId: currentUser.uid,
            content: content,
            createdAt: Timestamp.now()
        });

        // メッセージの返信数を増加
        await updateDoc(doc(db, 'messages', currentMessage.id), {
            replyCount: increment(1)
        });

        input.value = '';
    } catch (error) {
        console.error('返信送信エラー:', error);
    }
}

// ===================================================================
// 管理機能
// ===================================================================
function updateThreadMenuButtons(thread) {
    document.getElementById('pinThreadBtn').textContent = thread.isPinned ? '📌 ピン留め解除' : '📌 ピン留め';
    document.getElementById('lockThreadBtn').textContent = thread.isLocked ? '🔓 ロック解除' : '🔒 ロック';
}

async function pinThread() {
    if (!currentThread || !currentUserData?.isAdmin) return;

    try {
        await updateDoc(doc(db, 'threads', currentThread.id), {
            isPinned: !currentThread.isPinned
        });

        currentThread.isPinned = !currentThread.isPinned;
        updateThreadMenuButtons(currentThread);
        document.getElementById('threadMenu').classList.add('hidden');
    } catch (error) {
        console.error('ピン留めエラー:', error);
    }
}

async function lockThread() {
    if (!currentThread || !currentUserData?.isAdmin) return;

    try {
        await updateDoc(doc(db, 'threads', currentThread.id), {
            isLocked: !currentThread.isLocked
        });

        currentThread.isLocked = !currentThread.isLocked;
        updateThreadMenuButtons(currentThread);

        // ロック状態に応じてメッセージ入力欄を制御
        if (currentThread.isLocked) {
            document.getElementById('messageInputContainer').classList.add('hidden');
        } else if (currentUser) {
            document.getElementById('messageInputContainer').classList.remove('hidden');
        }

        document.getElementById('threadMenu').classList.add('hidden');
    } catch (error) {
        console.error('ロックエラー:', error);
    }
}

async function deleteThread() {
    if (!currentThread) return;
    if (!currentUserData?.isAdmin && currentUser?.uid !== currentThread.creatorId) return;

    if (!confirm('このスレッドを削除しますか？この操作は元に戻せません。')) return;

    try {
        // 関連するメッセージと返信も削除
        const messagesQuery = query(collection(db, 'messages'), where('threadId', '==', currentThread.id));
        const messagesSnapshot = await getDocs(messagesQuery);

        const deletePromises = [];

        messagesSnapshot.forEach(async (messageDoc) => {
            // 返信も削除
            const repliesQuery = query(collection(db, 'replies'), where('messageId', '==', messageDoc.id));
            const repliesSnapshot = await getDocs(repliesQuery);

            repliesSnapshot.forEach((replyDoc) => {
                deletePromises.push(deleteDoc(replyDoc.ref));
            });

            deletePromises.push(deleteDoc(messageDoc.ref));
        });

        deletePromises.push(deleteDoc(doc(db, 'threads', currentThread.id)));

        await Promise.all(deletePromises);

        hideThreadDetail();
        setupRealtimeThreadsListener();
    } catch (error) {
        console.error('スレッド削除エラー:', error);
        alert('スレッドの削除に失敗しました。');
    }
}

// ===================================================================
// パスワード保護機能
// ===================================================================
function showPasswordModal(thread) {
    currentThread = thread;
    document.getElementById('passwordOverlay').classList.remove('hidden');
    document.getElementById('passwordInput').focus();
}

function hidePasswordModal() {
    document.getElementById('passwordOverlay').classList.add('hidden');
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordError').classList.add('hidden');
}

async function handlePasswordSubmit(e) {
    e.preventDefault();

    if (!currentThread) return;

    const password = document.getElementById('passwordInput').value;

    try {
        const threadDoc = await getDoc(doc(db, 'threads', currentThread.id));
        if (!threadDoc.exists()) return;

        const threadData = threadDoc.data();

        if (threadData.password === password) {
            hidePasswordModal();
            currentThread.passwordVerified = true;
            showThreadDetail(currentThread);
        } else {
            showError(document.getElementById('passwordError'), 'パスワードが間違っています。');
        }
    } catch (error) {
        showError(document.getElementById('passwordError'), 'エラーが発生しました。');
    }
}

// ===================================================================
// 検索機能
// ===================================================================
function handleSearch(e) {
    searchQuery = e.target.value.trim();
    setupRealtimeThreadsListener();
}

// ===================================================================
// ユーティリティ関数
// ===================================================================
function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/(\r\n|\n|\r)/g, '<br>');
}

function createThreadMetaHTML(thread) {
    const date = thread.createdAt?.toDate().toLocaleDateString('ja-JP');
    const isAdminOrCreator = currentUserData?.isAdmin || currentUser?.uid === thread.creatorId;
    const passwordDisplay = (thread.hasPassword && isAdminOrCreator) ? ` | パスワード: ${thread.password || '設定済み'}` : '';

    return `作成日: ${date} | メッセージ: ${thread.messageCount || 0} | いいね: ${thread.likeCount || 0} | スコア: ${thread.popularityScore || 0}${passwordDisplay}`;
}

function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');

    setTimeout(() => {
        element.classList.add('hidden');
    }, 5000);
}

function getErrorMessage(errorCode) {
    const messages = {
        'auth/user-not-found': 'ユーザーが見つかりません。',
        'auth/wrong-password': 'パスワードが間違っています。',
        'auth/email-already-in-use': 'このメールアドレスは既に使用されています。',
        'auth/weak-password': 'パスワードは6文字以上で入力してください。',
        'auth/invalid-email': '無効なメールアドレスです。'
    };

    return messages[errorCode] || 'エラーが発生しました。';
}

// ===================================================================
// グローバル関数（HTMLから呼び出し用）
// ===================================================================
window.toggleLike = toggleLike;
window.showReplyDetail = showReplyDetail;
window.deleteMessage = deleteMessage;
window.toggleThreadLike = toggleThreadLike;
window.showThreadCardMenu = showThreadCardMenu;
window.togglePin = togglePin;
window.toggleLock = toggleLock;
window.deleteThreadFromCard = deleteThreadFromCard;