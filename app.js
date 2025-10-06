// ===================================================================
// Forums アプリケーション - メインロジック（リアルタイム対応版）
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
    arrayUnion,
    arrayRemove,
    increment,
    writeBatch
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

// リアルタイムリスナーの管理
let threadsUnsubscribe = null;
let messagesUnsubscribe = null;
let repliesUnsubscribe = null;

// ===================================================================
// 初期化
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('%c アプリケーション初期化中...', 'color: #2196F3; font-weight: bold');
    setupEventListeners();
    setupAuthStateListener();
});

// ===================================================================
// 認証状態の監視
// ===================================================================
function setupAuthStateListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('%c ログイン済み: ' + user.uid, 'color: #4CAF50');
            currentUser = user;
            await loadUserData(user.uid);
            updateUIForLoggedInUser();
        } else {
            console.log('%c 未ログイン', 'color: #FF9800');
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
            console.log('ユーザーデータ読み込み完了:', currentUserData.username, currentUserData.isAdmin ? '(管理者)' : '');
        }
    } catch (error) {
        console.error('ユーザーデータの読み込みエラー:', error);
    }
}

// ===================================================================
// リアルタイムリスナーの設定
// ===================================================================
function setupRealtimeThreadsListener() {
    // 既存のリスナーを解除
    if (threadsUnsubscribe) {
        threadsUnsubscribe();
    }

    const container = document.getElementById('threadsContainer');
    container.innerHTML = '<p style="text-align:center; padding: 40px; color: #999;">読み込み中...</p>';

    try {
        let q = collection(db, 'threads');
        
        // ソート順に応じてクエリを調整
        if (currentSort === 'new') {
            q = query(q, orderBy('createdAt', 'desc'));
        } else if (currentSort === 'old') {
            q = query(q, orderBy('createdAt', 'asc'));
        } else if (currentSort === 'popular') {
            q = query(q, orderBy('messageCount', 'desc'));
        }

        // リアルタイムリスナーを設定
        threadsUnsubscribe = onSnapshot(q, (querySnapshot) => {
            console.log('%c リアルタイム更新: スレッド一覧', 'color: #4CAF50; font-weight: bold');
            
            let threads = [];
            querySnapshot.forEach((doc) => {
                threads.push({ id: doc.id, ...doc.data() });
            });

            // 検索フィルター
            if (searchQuery) {
                threads = threads.filter(thread => {
                    return thread.tags && thread.tags.some(tag => 
                        tag.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                });
            }

            // 固定スレッドを最上部に
            threads.sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return 0;
            });

            displayThreads(threads);
        }, (error) => {
            console.error('リアルタイムリスナーエラー:', error);
            container.innerHTML = '<p style="text-align:center; padding: 40px; color: #f44336;">エラーが発生しました。</p>';
        });

    } catch (error) {
        console.error('リアルタイムリスナー設定エラー:', error);
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #f44336;">エラーが発生しました。</p>';
    }
}

function setupRealtimeMessagesListener(threadId) {
    // 既存のリスナーを解除
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }

    const container = document.getElementById('messagesContainer');
    container.innerHTML = '<p style="text-align:center; padding: 40px; color: #999;">読み込み中...</p>';

    try {
        const q = query(collection(db, 'messages'), 
                       where('threadId', '==', threadId), 
                       orderBy('createdAt', 'asc'));

        // リアルタイムリスナーを設定
        messagesUnsubscribe = onSnapshot(q, (querySnapshot) => {
            console.log('%c リアルタイム更新: メッセージ一覧', 'color: #4CAF50; font-weight: bold');
            
            const messages = [];
            querySnapshot.forEach((doc) => {
                messages.push({ id: doc.id, ...doc.data() });
            });

            displayMessages(messages);
        }, (error) => {
            console.error('メッセージリスナーエラー:', error);
            container.innerHTML = '<p style="text-align:center; padding: 40px; color: #f44336;">エラーが発生しました。</p>';
        });

    } catch (error) {
        console.error('メッセージリスナー設定エラー:', error);
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #f44336;">エラーが発生しました。</p>';
    }
}

function setupRealtimeRepliesListener(messageId) {
    // 既存のリスナーを解除
    if (repliesUnsubscribe) {
        repliesUnsubscribe();
    }

    const container = document.getElementById('repliesContainer');
    container.innerHTML = '<p style="text-align:center; padding: 40px; color: #999;">読み込み中...</p>';

    try {
        const q = query(collection(db, 'replies'), 
                       where('messageId', '==', messageId), 
                       orderBy('createdAt', 'asc'));

        // リアルタイムリスナーを設定
        repliesUnsubscribe = onSnapshot(q, (querySnapshot) => {
            console.log('%c リアルタイム更新: 返信一覧', 'color: #4CAF50; font-weight: bold');
            
            const replies = [];
            querySnapshot.forEach((doc) => {
                replies.push({ id: doc.id, ...doc.data() });
            });

            displayReplies(replies);
        }, (error) => {
            console.error('返信リスナーエラー:', error);
            container.innerHTML = '<p style="text-align:center; padding: 40px; color: #f44336;">エラーが発生しました。</p>';
        });

    } catch (error) {
        console.error('返信リスナー設定エラー:', error);
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #f44336;">エラーが発生しました。</p>';
    }
}

// ===================================================================
// イベントリスナー設定
// ===================================================================
function setupEventListeners() {
    // ロゴクリック
    document.getElementById('logoBtn').addEventListener('click', () => {
        searchQuery = '';
        currentSort = 'new';
        document.getElementById('searchInput').value = '';
        document.getElementById('sortLabel').textContent = '新規順';
        hideThreadDetail();
        hideReplyDetail();
        setupRealtimeThreadsListener();
    });

    // アカウントボタン
    document.getElementById('accountBtn').addEventListener('click', showAccountModal);
    document.getElementById('modalOverlay').addEventListener('click', hideAccountModal);

    // ログインフォーム
    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    document.getElementById('showRegisterLink').addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
    });

    // 登録フォーム
    document.getElementById('registerFormElement').addEventListener('submit', handleRegister);
    document.getElementById('showLoginLink').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });

    // ログアウト・アカウント削除
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('deleteAccountBtn').addEventListener('click', handleDeleteAccount);

    // スレッド作成
    document.getElementById('createThreadBtn').addEventListener('click', showCreateThreadModal);
    document.getElementById('createThreadOverlay').addEventListener('click', hideCreateThreadModal);
    document.getElementById('cancelCreateBtn').addEventListener('click', hideCreateThreadModal);
    document.getElementById('createThreadForm').addEventListener('submit', handleCreateThread);
    document.getElementById('tagInput').addEventListener('keydown', handleTagInput);

    // 検索・ソート
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('sortBtn').addEventListener('click', toggleSortMenu);
    document.querySelectorAll('.sort-option').forEach(btn => {
        btn.addEventListener('click', (e) => handleSort(e.target.dataset.sort));
    });

    // スレッド詳細
    document.getElementById('backBtn').addEventListener('click', () => {
        hideThreadDetail();
        setupRealtimeThreadsListener();
    });
    document.getElementById('sendMessageBtn').addEventListener('click', handleSendMessage);

    // 返信
    document.getElementById('replyBackBtn').addEventListener('click', () => {
        hideReplyDetail();
        showThreadDetail(currentThread);
    });
    document.getElementById('sendReplyBtn').addEventListener('click', handleSendReply);
}

// ===================================================================
// 認証処理
// ===================================================================
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    console.log('ログイン試行:', username);

    try {
        const email = username + '@forums.local';
        await signInWithEmailAndPassword(auth, email, password);
        console.log('%c ログイン成功', 'color: #4CAF50; font-weight: bold');
        hideAccountModal();
    } catch (error) {
        console.error('ログインエラー:', error.code);
        const errorBox = document.getElementById('loginError');
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            showError(errorBox, 'パスワードが違います。');
        } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
            showError(errorBox, '名前が間違っているか、\nアカウントが存在しません。');
        } else {
            showError(errorBox, 'ログインエラーが発生しました。');
        }
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;

    console.log('アカウント作成試行:', username);

    if (password.length < 6) {
        showError(document.getElementById('registerError'), 'パスワードは6文字以上必要です。');
        return;
    }

    try {
        const email = username + '@forums.local';
        
        // ユーザー名の重複チェック
        const usersQuery = query(collection(db, 'users'), where('username', '==', username));
        const querySnapshot = await getDocs(usersQuery);
        
        if (!querySnapshot.empty) {
            showError(document.getElementById('registerError'), 'この名前は既に使用されています。');
            return;
        }

        // アカウント作成
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Firestoreにユーザー情報を保存
        const isAdmin = username === 'AtsukiGames';
        await setDoc(doc(db, 'users', user.uid), {
            username: username,
            email: email,
            isAdmin: isAdmin,
            createdAt: Timestamp.now()
        });

        await updateProfile(user, { displayName: username });
        console.log('%c アカウント作成成功:', 'color: #4CAF50; font-weight: bold', username, isAdmin ? '(管理者)' : '');
        hideAccountModal();
    } catch (error) {
        console.error('アカウント作成エラー:', error);
        showError(document.getElementById('registerError'), 'アカウント作成エラーが発生しました。');
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        console.log('%c ログアウト成功', 'color: #4CAF50; font-weight: bold');
        hideAccountModal();
    } catch (error) {
        console.error('ログアウトエラー:', error);
        alert('ログアウトエラーが発生しました。');
    }
}

async function handleDeleteAccount() {
    const password = prompt('アカウント削除のためパスワードを入力してください:');
    if (!password) return;

    try {
        const email = currentUserData.username + '@forums.local';
        await signInWithEmailAndPassword(auth, email, password);
        
        // Firestoreからユーザーデータを削除
        await deleteDoc(doc(db, 'users', currentUser.uid));
        
        // Authenticationからユーザーを削除
        await deleteUser(currentUser);
        
        console.log('%c アカウント削除成功', 'color: #4CAF50; font-weight: bold');
        hideAccountModal();
        alert('アカウントが削除されました。');
    } catch (error) {
        console.error('アカウント削除エラー:', error);
        if (error.code === 'auth/wrong-password') {
            alert('パスワードが違います。');
        } else {
            alert('アカウント削除エラーが発生しました。');
        }
    }
}

// ===================================================================
// スレッド管理
// ===================================================================
async function displayThreads(threads) {
    const container = document.getElementById('threadsContainer');
    
    if (threads.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #999;">スレッドがありません。</p>';
        return;
    }

    container.innerHTML = '';
    
    for (const thread of threads) {
        const card = document.createElement('div');
        card.className = 'thread-card' + (thread.isPinned ? ' pinned' : '');
        
        let creatorName = 'Unknown';
        try {
            const creatorDoc = await getDoc(doc(db, 'users', thread.creatorId));
            if (creatorDoc.exists()) {
                creatorName = creatorDoc.data().username;
            }
        } catch (error) {
            console.error('作成者情報の取得エラー:', error);
        }

        const date = thread.createdAt?.toDate().toLocaleDateString('ja-JP');
        
        card.innerHTML = `
            ${thread.isPinned ? '<div class="thread-pin-badge">📌固定されています</div>' : ''}
            <h3 class="thread-card-title">${escapeHtml(thread.title)}</h3>
            <div class="thread-card-meta">
                <span>作成者: ${escapeHtml(creatorName)}</span>
                <span>作成日: ${date}</span>
                <span>💬 ${thread.messageCount || 0}</span>
            </div>
            <div class="thread-card-tags">
                ${thread.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        `;

        // スレッドオーナーまたは管理者の場合、メニューボタンを追加
        if (currentUserData && (currentUserData.id === thread.creatorId || currentUserData.isAdmin)) {
            const menuBtn = document.createElement('button');
            menuBtn.className = 'thread-menu-trigger';
            menuBtn.textContent = '…';
            menuBtn.onclick = (e) => {
                e.stopPropagation();
                showThreadMenu(thread, menuBtn);
            };
            card.appendChild(menuBtn);
        }

        card.onclick = () => showThreadDetail(thread);
        container.appendChild(card);
    }
}

function showThreadMenu(thread, buttonElement) {
    // 既存のメニューを閉じる
    document.querySelectorAll('.thread-card-menu').forEach(menu => menu.remove());

    const menu = document.createElement('div');
    menu.className = 'thread-menu';
    menu.style.position = 'absolute';
    menu.style.top = '100%';
    menu.style.right = '0';
    menu.style.backgroundColor = 'white';
    menu.style.border = '1px solid #ddd';
    menu.style.borderRadius = '8px';
    menu.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
    menu.style.minWidth = '150px';
    menu.style.zIndex = '10';

    const options = [];
    
    if (currentUserData.isAdmin) {
        options.push({
            text: thread.isPinned ? '固定解除' : '固定',
            action: () => togglePin(thread)
        });
        options.push({
            text: thread.isLocked ? 'ロック解除' : 'ロック',
            action: () => toggleLock(thread)
        });
    }
    
    options.push({
        text: '削除',
        action: () => deleteThreadFromList(thread)
    });

    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'menu-option';
        btn.textContent = option.text;
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.padding = '8px 16px';
        btn.style.border = 'none';
        btn.style.background = 'none';
        btn.style.textAlign = 'left';
        btn.style.cursor = 'pointer';
        btn.onmouseover = () => btn.style.backgroundColor = '#f5f5f5';
        btn.onmouseout = () => btn.style.backgroundColor = 'transparent';
        btn.onclick = (e) => {
            e.stopPropagation();
            option.action();
            menu.remove();
        };
        menu.appendChild(btn);
    });

    buttonElement.parentElement.appendChild(menu);
    menu.classList.add('thread-card-menu');

    // メニュー外をクリックしたら閉じる
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && e.target !== buttonElement) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

async function togglePin(thread) {
    try {
        const batch = writeBatch(db);
        
        if (!thread.isPinned) {
            // 新しく固定する場合、既存の固定を全て解除
            const threadsQuery = query(collection(db, 'threads'), where('isPinned', '==', true));
            const pinnedThreads = await getDocs(threadsQuery);
            
            pinnedThreads.forEach((doc) => {
                batch.update(doc.ref, { isPinned: false });
                console.log('既存の固定を解除:', doc.id);
            });
            
            // 新しいスレッドを固定
            batch.update(doc(db, 'threads', thread.id), { isPinned: true });
            console.log('%c スレッドを固定:', 'color: #4CAF50; font-weight: bold', thread.title);
        } else {
            // 固定解除
            batch.update(doc(db, 'threads', thread.id), { isPinned: false });
            console.log('固定解除:', thread.title);
        }
        
        await batch.commit();
    } catch (error) {
        console.error('固定切り替えエラー:', error);
        alert('操作に失敗しました。');
    }
}

async function toggleLock(thread) {
    try {
        await updateDoc(doc(db, 'threads', thread.id), {
            isLocked: !thread.isLocked
        });
        console.log('ロック状態変更:', thread.title);
    } catch (error) {
        console.error('ロック切り替えエラー:', error);
        alert('操作に失敗しました。');
    }
}

async function deleteThreadFromList(thread) {
    if (!confirm('このスレッドを削除しますか？')) return;

    try {
        await deleteDoc(doc(db, 'threads', thread.id));
        
        // 関連メッセージと返信も削除
        const messagesQuery = query(collection(db, 'messages'), where('threadId', '==', thread.id));
        const messagesSnapshot = await getDocs(messagesQuery);
        
        for (const messageDoc of messagesSnapshot.docs) {
            const repliesQuery = query(collection(db, 'replies'), where('messageId', '==', messageDoc.id));
            const repliesSnapshot = await getDocs(repliesQuery);
            
            for (const replyDoc of repliesSnapshot.docs) {
                await deleteDoc(replyDoc.ref);
            }
            
            await deleteDoc(messageDoc.ref);
        }

        console.log('%c スレッド削除:', 'color: #f44336; font-weight: bold', thread.title);
    } catch (error) {
        console.error('スレッド削除エラー:', error);
        alert('削除に失敗しました。');
    }
}

async function handleCreateThread(e) {
    e.preventDefault();
    const title = document.getElementById('threadTitle').value.trim();
    const tags = Array.from(document.getElementById('tagsContainer').children)
        .map(pill => pill.dataset.tag);

    if (!title || tags.length === 0) {
        showError(document.getElementById('createThreadError'), '内容が不足しています。');
        return;
    }

    try {
        await addDoc(collection(db, 'threads'), {
            title: title,
            tags: tags,
            creatorId: currentUser.uid,
            createdAt: Timestamp.now(),
            messageCount: 0,
            isPinned: false,
            isLocked: false
        });

        console.log('%c スレッド作成:', 'color: #4CAF50; font-weight: bold', title);
        hideCreateThreadModal();
    } catch (error) {
        console.error('スレッド作成エラー:', error);
        showError(document.getElementById('createThreadError'), 'スレッド作成に失敗しました。');
    }
}

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
// スレッド詳細表示
// ===================================================================
async function showThreadDetail(thread) {
    currentThread = thread;
    
    document.querySelector('.main-content').classList.add('hidden');
    document.getElementById('threadDetail').classList.remove('hidden');
    document.getElementById('threadDetailTitle').textContent = thread.title;

    // ロック状態の表示
    const messageInputContainer = document.getElementById('messageInputContainer');
    const lockedMessage = document.getElementById('lockedMessage');
    
    if (thread.isLocked && (!currentUserData || !currentUserData.isAdmin)) {
        messageInputContainer.classList.add('hidden');
        lockedMessage.classList.remove('hidden');
    } else if (currentUser) {
        messageInputContainer.classList.remove('hidden');
        lockedMessage.classList.add('hidden');
    } else {
        messageInputContainer.classList.add('hidden');
        lockedMessage.classList.add('hidden');
    }

    // メニューボタンの表示制御
    const threadMenuBtn = document.getElementById('threadMenuBtn');
    const threadMenu = document.getElementById('threadMenu');
    
    if (currentUserData && (currentUserData.id === thread.creatorId || currentUserData.isAdmin)) {
        threadMenuBtn.classList.remove('hidden');
        
        const pinBtn = document.getElementById('pinThreadBtn');
        const lockBtn = document.getElementById('lockThreadBtn');
        
        pinBtn.textContent = thread.isPinned ? '固定解除' : '固定';
        lockBtn.textContent = thread.isLocked ? 'ロック解除' : 'ロック';
        
        if (currentUserData.isAdmin) {
            pinBtn.style.display = 'block';
            lockBtn.style.display = 'block';
        } else {
            pinBtn.style.display = 'none';
            lockBtn.style.display = 'none';
        }
        
        pinBtn.onclick = () => {
            togglePin(thread);
            threadMenu.classList.add('hidden');
        };
        lockBtn.onclick = () => {
            toggleLock(thread);
            threadMenu.classList.add('hidden');
        };
        document.getElementById('deleteThreadBtn').onclick = () => {
            deleteThread(thread);
        };
        
        threadMenuBtn.onclick = (e) => {
            e.stopPropagation();
            threadMenu.classList.toggle('hidden');
        };
    } else {
        threadMenuBtn.classList.add('hidden');
    }

    setupRealtimeMessagesListener(thread.id);
}

async function deleteThread(thread) {
    if (!confirm('このスレッドを削除しますか？')) return;

    try {
        await deleteDoc(doc(db, 'threads', thread.id));
        
        const messagesQuery = query(collection(db, 'messages'), where('threadId', '==', thread.id));
        const messagesSnapshot = await getDocs(messagesQuery);
        
        for (const messageDoc of messagesSnapshot.docs) {
            const repliesQuery = query(collection(db, 'replies'), where('messageId', '==', messageDoc.id));
            const repliesSnapshot = await getDocs(repliesQuery);
            
            for (const replyDoc of repliesSnapshot.docs) {
                await deleteDoc(replyDoc.ref);
            }
            
            await deleteDoc(messageDoc.ref);
        }

        console.log('%c スレッド削除:', 'color: #f44336; font-weight: bold', thread.title);
        hideThreadDetail();
    } catch (error) {
        console.error('スレッド削除エラー:', error);
        alert('削除に失敗しました。');
    }
}

async function displayMessages(messages) {
    const container = document.getElementById('messagesContainer');
    
    if (messages.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #999;">メッセージがありません。</p>';
        return;
    }

    container.innerHTML = '';

    for (const message of messages) {
        const card = document.createElement('div');
        card.className = 'message-card';

        let authorName = 'Unknown';
        let isAdmin = false;
        let isOwner = false;

        try {
            const authorDoc = await getDoc(doc(db, 'users', message.userId));
            if (authorDoc.exists()) {
                const authorData = authorDoc.data();
                authorName = authorData.username;
                isAdmin = authorData.isAdmin;
                isOwner = message.userId === currentThread.creatorId;
            }
        } catch (error) {
            console.error('作成者情報の取得エラー:', error);
        }

        const date = message.createdAt?.toDate().toLocaleString('ja-JP');
        const likeCount = message.likes ? message.likes.length : 0;

        let authorClass = 'message-author';
        let displayName = authorName;
        
        if (isAdmin) {
            authorClass += ' admin';
        } else if (isOwner) {
            authorClass += ' owner';
            displayName = 'スレ主';
        }

        card.innerHTML = `
            <div class="message-header">
                <span class="${authorClass}">${escapeHtml(displayName)}</span>
                <span class="message-date">${date}</span>
            </div>
            <div class="message-content">${escapeHtml(message.content)}</div>
            <div class="message-actions">
                <button class="message-action-btn like-btn" data-message-id="${message.id}">
                    👍 ${likeCount}
                </button>
                <button class="message-action-btn reply-btn" data-message-id="${message.id}">
                    💬 ${message.replyCount || 0}
                </button>
            </div>
        `;

        card.querySelector('.like-btn').onclick = () => handleLike(message);
        card.querySelector('.reply-btn').onclick = () => showReplyDetail(message);

        container.appendChild(card);
    }
}

async function handleSendMessage() {
    const content = document.getElementById('messageInput').value.trim();
    
    if (!content) return;
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }

    try {
        await addDoc(collection(db, 'messages'), {
            threadId: currentThread.id,
            userId: currentUser.uid,
            content: content,
            createdAt: Timestamp.now(),
            likes: [],
            replyCount: 0
        });

        await updateDoc(doc(db, 'threads', currentThread.id), {
            messageCount: increment(1)
        });

        console.log('%c メッセージ送信成功', 'color: #4CAF50; font-weight: bold');
        document.getElementById('messageInput').value = '';
    } catch (error) {
        console.error('メッセージ送信エラー:', error);
        alert('メッセージの送信に失敗しました。');
    }
}

async function handleLike(message) {
    if (!currentUser) return;

    try {
        const messageRef = doc(db, 'messages', message.id);
        const isLiked = message.likes && message.likes.includes(currentUser.uid);

        if (isLiked) {
            await updateDoc(messageRef, {
                likes: arrayRemove(currentUser.uid)
            });
        } else {
            await updateDoc(messageRef, {
                likes: arrayUnion(currentUser.uid)
            });
        }
    } catch (error) {
        console.error('いいねエラー:', error);
    }
}

// ===================================================================
// 返信機能
// ===================================================================
async function showReplyDetail(message) {
    currentMessage = message;
    
    document.getElementById('threadDetail').classList.add('hidden');
    document.getElementById('replyDetail').classList.remove('hidden');
    document.getElementById('replyDetailTitle').textContent = currentThread.title + ' - 返信';

    let authorName = 'Unknown';
    try {
        const authorDoc = await getDoc(doc(db, 'users', message.userId));
        if (authorDoc.exists()) {
            authorName = authorDoc.data().username;
        }
    } catch (error) {
        console.error('作成者情報の取得エラー:', error);
    }

    const originalMessageDiv = document.getElementById('originalMessage');
    const date = message.createdAt?.toDate().toLocaleString('ja-JP');
    
    originalMessageDiv.innerHTML = `
        <div class="message-card">
            <div class="message-header">
                <span class="message-author">${escapeHtml(authorName)}</span>
                <span class="message-date">${date}</span>
            </div>
            <div class="message-content">${escapeHtml(message.content)}</div>
        </div>
    `;

    const replyInputContainer = document.getElementById('replyInputContainer');
    if (currentUser) {
        replyInputContainer.classList.remove('hidden');
    } else {
        replyInputContainer.classList.add('hidden');
    }

    setupRealtimeRepliesListener(message.id);
}

async function displayReplies(replies) {
    const container = document.getElementById('repliesContainer');
    
    if (replies.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #999;">返信がありません。</p>';
        return;
    }

    container.innerHTML = '';

    for (const reply of replies) {
        const card = document.createElement('div');
        card.className = 'message-card';

        let authorName = 'Unknown';
        try {
            const authorDoc = await getDoc(doc(db, 'users', reply.userId));
            if (authorDoc.exists()) {
                authorName = authorDoc.data().username;
            }
        } catch (error) {
            console.error('作成者情報の取得エラー:', error);
        }

        const date = reply.createdAt?.toDate().toLocaleString('ja-JP');

        card.innerHTML = `
            <div class="message-header">
                <span class="message-author">${escapeHtml(authorName)}</span>
                <span class="message-date">${date}</span>
            </div>
            <div class="message-content">${escapeHtml(reply.content)}</div>
        `;

        container.appendChild(card);
    }
}

async function handleSendReply() {
    const content = document.getElementById('replyInput').value.trim();
    
    if (!content) return;
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }

    try {
        await addDoc(collection(db, 'replies'), {
            messageId: currentMessage.id,
            userId: currentUser.uid,
            content: content,
            createdAt: Timestamp.now()
        });

        await updateDoc(doc(db, 'messages', currentMessage.id), {
            replyCount: increment(1)
        });

        console.log('%c 返信送信成功', 'color: #4CAF50; font-weight: bold');
        document.getElementById('replyInput').value = '';
    } catch (error) {
        console.error('返信送信エラー:', error);
        alert('返信の送信に失敗しました。');
    }
}

// ===================================================================
// 検索・ソート
// ===================================================================
function handleSearch(e) {
    searchQuery = e.target.value;
    console.log('検索:', searchQuery);
    setupRealtimeThreadsListener();
}

function toggleSortMenu() {
    document.getElementById('sortMenu').classList.toggle('hidden');
}

function handleSort(sort) {
    currentSort = sort;
    const labels = { new: '新規順', popular: '人気順', old: '古い順' };
    document.getElementById('sortLabel').textContent = labels[sort];
    document.getElementById('sortMenu').classList.add('hidden');
    console.log('ソート:', sort);
    setupRealtimeThreadsListener();
}

// ===================================================================
// UI制御
// ===================================================================
function updateUIForLoggedInUser() {
    document.getElementById('createThreadBtn').classList.remove('hidden');
}

function updateUIForLoggedOutUser() {
    document.getElementById('createThreadBtn').classList.add('hidden');
}

function showAccountModal() {
    document.getElementById('accountModal').classList.remove('hidden');
    
    if (currentUser && currentUserData) {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('userMenu').classList.remove('hidden');
        document.getElementById('userName').textContent = currentUserData.username + 
            (currentUserData.isAdmin ? ' (管理者)' : '');
    } else {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('userMenu').classList.add('hidden');
    }
}

function hideAccountModal() {
    document.getElementById('accountModal').classList.add('hidden');
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('registerError').classList.add('hidden');
}

function showLoginForm() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('registerError').classList.add('hidden');
}

function showRegisterForm() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('loginError').classList.add('hidden');
}

function showCreateThreadModal() {
    document.getElementById('createThreadModal').classList.remove('hidden');
    document.getElementById('threadTitle').value = '';
    document.getElementById('tagsContainer').innerHTML = '';
    document.getElementById('tagInput').value = '';
    document.getElementById('createThreadError').classList.add('hidden');
}

function hideCreateThreadModal() {
    document.getElementById('createThreadModal').classList.add('hidden');
}

function hideThreadDetail() {
    document.getElementById('threadDetail').classList.add('hidden');
    document.querySelector('.main-content').classList.remove('hidden');
    document.getElementById('threadMenu').classList.add('hidden');
    
    // メッセージリスナーを解除
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
}

function hideReplyDetail() {
    document.getElementById('replyDetail').classList.add('hidden');
    
    // 返信リスナーを解除
    if (repliesUnsubscribe) {
        repliesUnsubscribe();
        repliesUnsubscribe = null;
    }
}

function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===================================================================
// グローバルクリックイベント（メニューを閉じる）
// ===================================================================
document.addEventListener('click', (e) => {
    if (!e.target.closest('.sort-dropdown')) {
        document.getElementById('sortMenu').classList.add('hidden');
    }
    if (!e.target.closest('.thread-menu-btn') && !e.target.closest('.thread-menu')) {
        document.getElementById('threadMenu').classList.add('hidden');
    }
});

// ===================================================================
// ページ離脱時のクリーンアップ
// ===================================================================
window.addEventListener('beforeunload', () => {
    if (threadsUnsubscribe) threadsUnsubscribe();
    if (messagesUnsubscribe) messagesUnsubscribe();
    if (repliesUnsubscribe) repliesUnsubscribe();
});

console.log('%c Forums アプリケーション初期化完了', 'color: #4CAF50; font-weight: bold; font-size: 16px');
