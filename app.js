// ===================================================================
// Forums 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ - 繝｡繧､繝ｳ繝ｭ繧ｸ繝・け・医Μ繧｢繝ｫ繧ｿ繧､繝蟇ｾ蠢懃沿・・// ===================================================================

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
// 繧ｰ繝ｭ繝ｼ繝舌Ν迥ｶ諷狗ｮ｡逅・// ===================================================================
let currentUser = null;
let currentUserData = null;
let currentThread = null;
let currentMessage = null;
let currentSort = 'new';
let searchQuery = '';

// 繝ｪ繧｢繝ｫ繧ｿ繧､繝繝ｪ繧ｹ繝翫・縺ｮ邂｡逅・let threadsUnsubscribe = null;
let messagesUnsubscribe = null;
let repliesUnsubscribe = null;

// ===================================================================
// 蛻晄悄蛹・// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('%c 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ蛻晄悄蛹紋ｸｭ...', 'color: #2196F3; font-weight: bold');
    setupEventListeners();
    setupAuthStateListener();
});

// ===================================================================
// 隱崎ｨｼ迥ｶ諷九・逶｣隕・// ===================================================================
function setupAuthStateListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('%c 繝ｭ繧ｰ繧､繝ｳ貂医∩: ' + user.uid, 'color: #4CAF50');
            currentUser = user;
            await loadUserData(user.uid);
            updateUIForLoggedInUser();
        } else {
            console.log('%c 譛ｪ繝ｭ繧ｰ繧､繝ｳ', 'color: #FF9800');
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
            console.log('繝ｦ繝ｼ繧ｶ繝ｼ繝・・繧ｿ隱ｭ縺ｿ霎ｼ縺ｿ螳御ｺ・', currentUserData.username, currentUserData.isAdmin ? '(邂｡逅・・' : '');
        }
    } catch (error) {
        console.error('繝ｦ繝ｼ繧ｶ繝ｼ繝・・繧ｿ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ繧ｨ繝ｩ繝ｼ:', error);
    }
}

// ===================================================================
// 繝ｪ繧｢繝ｫ繧ｿ繧､繝繝ｪ繧ｹ繝翫・縺ｮ險ｭ螳・// ===================================================================
function setupRealtimeThreadsListener() {
    // 譌｢蟄倥・繝ｪ繧ｹ繝翫・繧定ｧ｣髯､
    if (threadsUnsubscribe) {
        threadsUnsubscribe();
    }

    const container = document.getElementById('threadsContainer');
    container.innerHTML = '<p style="text-align:center; padding: 40px; color: #999;">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p>';

    try {
        let q = collection(db, 'threads');
        
        // 繧ｽ繝ｼ繝磯・↓蠢懊§縺ｦ繧ｯ繧ｨ繝ｪ繧定ｪｿ謨ｴ
        if (currentSort === 'new') {
            q = query(q, orderBy('createdAt', 'desc'));
        } else if (currentSort === 'old') {
            q = query(q, orderBy('createdAt', 'asc'));
        } else if (currentSort === 'popular') {
            q = query(q, orderBy('messageCount', 'desc'));
        }

        // 繝ｪ繧｢繝ｫ繧ｿ繧､繝繝ｪ繧ｹ繝翫・繧定ｨｭ螳・        threadsUnsubscribe = onSnapshot(q, (querySnapshot) => {
            console.log('%c 繝ｪ繧｢繝ｫ繧ｿ繧､繝譖ｴ譁ｰ: 繧ｹ繝ｬ繝・ラ荳隕ｧ', 'color: #4CAF50; font-weight: bold');
            
            let threads = [];
            querySnapshot.forEach((doc) => {
                threads.push({ id: doc.id, ...doc.data() });
            });

            // 讀懃ｴ｢繝輔ぅ繝ｫ繧ｿ繝ｼ
            if (searchQuery) {
                threads = threads.filter(thread => {
                    return thread.tags && thread.tags.some(tag => 
                        tag.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                });
            }

            // 蝗ｺ螳壹せ繝ｬ繝・ラ繧呈怙荳企Κ縺ｫ
            threads.sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return 0;
            });

            displayThreads(threads);
        }, (error) => {
            console.error('繝ｪ繧｢繝ｫ繧ｿ繧､繝繝ｪ繧ｹ繝翫・繧ｨ繝ｩ繝ｼ:', error);
            container.innerHTML = '<p style="text-align:center; padding: 40px; color: #f44336;">繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・/p>';
        });

    } catch (error) {
        console.error('繝ｪ繧｢繝ｫ繧ｿ繧､繝繝ｪ繧ｹ繝翫・險ｭ螳壹お繝ｩ繝ｼ:', error);
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #f44336;">繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・/p>';
    }
}

function setupRealtimeMessagesListener(threadId) {
    // 譌｢蟄倥・繝ｪ繧ｹ繝翫・繧定ｧ｣髯､
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }

    const container = document.getElementById('messagesContainer');
    container.innerHTML = '<p style="text-align:center; padding: 40px; color: #999;">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p>';

    try {
        const q = query(collection(db, 'messages'), 
                       where('threadId', '==', threadId), 
                       orderBy('createdAt', 'asc'));

        // 繝ｪ繧｢繝ｫ繧ｿ繧､繝繝ｪ繧ｹ繝翫・繧定ｨｭ螳・        messagesUnsubscribe = onSnapshot(q, (querySnapshot) => {
            console.log('%c 繝ｪ繧｢繝ｫ繧ｿ繧､繝譖ｴ譁ｰ: 繝｡繝・そ繝ｼ繧ｸ荳隕ｧ', 'color: #4CAF50; font-weight: bold');
            
            const messages = [];
            querySnapshot.forEach((doc) => {
                messages.push({ id: doc.id, ...doc.data() });
            });

            displayMessages(messages);
        }, (error) => {
            console.error('繝｡繝・そ繝ｼ繧ｸ繝ｪ繧ｹ繝翫・繧ｨ繝ｩ繝ｼ:', error);
            container.innerHTML = '<p style="text-align:center; padding: 40px; color: #f44336;">繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・/p>';
        });

    } catch (error) {
        console.error('繝｡繝・そ繝ｼ繧ｸ繝ｪ繧ｹ繝翫・險ｭ螳壹お繝ｩ繝ｼ:', error);
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #f44336;">繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・/p>';
    }
}

function setupRealtimeRepliesListener(messageId) {
    // 譌｢蟄倥・繝ｪ繧ｹ繝翫・繧定ｧ｣髯､
    if (repliesUnsubscribe) {
        repliesUnsubscribe();
    }

    const container = document.getElementById('repliesContainer');
    container.innerHTML = '<p style="text-align:center; padding: 40px; color: #999;">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p>';

    try {
        const q = query(collection(db, 'replies'), 
                       where('messageId', '==', messageId), 
                       orderBy('createdAt', 'asc'));

        // 繝ｪ繧｢繝ｫ繧ｿ繧､繝繝ｪ繧ｹ繝翫・繧定ｨｭ螳・        repliesUnsubscribe = onSnapshot(q, (querySnapshot) => {
            console.log('%c 繝ｪ繧｢繝ｫ繧ｿ繧､繝譖ｴ譁ｰ: 霑比ｿ｡荳隕ｧ', 'color: #4CAF50; font-weight: bold');
            
            const replies = [];
            querySnapshot.forEach((doc) => {
                replies.push({ id: doc.id, ...doc.data() });
            });

            displayReplies(replies);
        }, (error) => {
            console.error('霑比ｿ｡繝ｪ繧ｹ繝翫・繧ｨ繝ｩ繝ｼ:', error);
            container.innerHTML = '<p style="text-align:center; padding: 40px; color: #f44336;">繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・/p>';
        });

    } catch (error) {
        console.error('霑比ｿ｡繝ｪ繧ｹ繝翫・險ｭ螳壹お繝ｩ繝ｼ:', error);
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #f44336;">繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・/p>';
    }
}

// ===================================================================
// 繧､繝吶Φ繝医Μ繧ｹ繝翫・險ｭ螳・// ===================================================================
function setupEventListeners() {
    // 繝ｭ繧ｴ繧ｯ繝ｪ繝・け
    document.getElementById('logoBtn').addEventListener('click', () => {
        searchQuery = '';
        currentSort = 'new';
        document.getElementById('searchInput').value = '';
        document.getElementById('sortLabel').textContent = '譁ｰ隕城・;
        hideThreadDetail();
        hideReplyDetail();
        setupRealtimeThreadsListener();
    });

    // 繧｢繧ｫ繧ｦ繝ｳ繝医・繧ｿ繝ｳ
    document.getElementById('accountBtn').addEventListener('click', showAccountModal);
    document.getElementById('modalOverlay').addEventListener('click', hideAccountModal);

    // 繝ｭ繧ｰ繧､繝ｳ繝輔か繝ｼ繝
    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    document.getElementById('showRegisterLink').addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
    });

    // 逋ｻ骭ｲ繝輔か繝ｼ繝
    document.getElementById('registerFormElement').addEventListener('submit', handleRegister);
    document.getElementById('showLoginLink').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });

    // 繝ｭ繧ｰ繧｢繧ｦ繝医・繧｢繧ｫ繧ｦ繝ｳ繝亥炎髯､
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('deleteAccountBtn').addEventListener('click', handleDeleteAccount);

    // 繧ｹ繝ｬ繝・ラ菴懈・
    document.getElementById('createThreadBtn').addEventListener('click', showCreateThreadModal);
    document.getElementById('createThreadOverlay').addEventListener('click', hideCreateThreadModal);
    document.getElementById('cancelCreateBtn').addEventListener('click', hideCreateThreadModal);
    document.getElementById('createThreadForm').addEventListener('submit', handleCreateThread);
    document.getElementById('tagInput').addEventListener('keydown', handleTagInput);

    // 讀懃ｴ｢繝ｻ繧ｽ繝ｼ繝・    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('sortBtn').addEventListener('click', toggleSortMenu);
    document.querySelectorAll('.sort-option').forEach(btn => {
        btn.addEventListener('click', (e) => handleSort(e.target.dataset.sort));
    });

    // 繧ｹ繝ｬ繝・ラ隧ｳ邏ｰ
    document.getElementById('backBtn').addEventListener('click', () => {
        hideThreadDetail();
        setupRealtimeThreadsListener();
    });
    document.getElementById('sendMessageBtn').addEventListener('click', handleSendMessage);

    // 霑比ｿ｡
    document.getElementById('replyBackBtn').addEventListener('click', () => {
        hideReplyDetail();
        showThreadDetail(currentThread);
    });
    document.getElementById('sendReplyBtn').addEventListener('click', handleSendReply);
}

// ===================================================================
// 隱崎ｨｼ蜃ｦ逅・// ===================================================================
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    console.log('繝ｭ繧ｰ繧､繝ｳ隧ｦ陦・', username);

    try {
        const email = username + '@forums.local';
        await signInWithEmailAndPassword(auth, email, password);
        console.log('%c 繝ｭ繧ｰ繧､繝ｳ謌仙粥', 'color: #4CAF50; font-weight: bold');
        hideAccountModal();
    } catch (error) {
        console.error('繝ｭ繧ｰ繧､繝ｳ繧ｨ繝ｩ繝ｼ:', error.code);
        const errorBox = document.getElementById('loginError');
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            showError(errorBox, '繝代せ繝ｯ繝ｼ繝峨′驕輔＞縺ｾ縺吶・);
        } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
            showError(errorBox, '蜷榊燕縺碁俣驕輔▲縺ｦ縺・ｋ縺九―n繧｢繧ｫ繧ｦ繝ｳ繝医′蟄伜惠縺励∪縺帙ｓ縲・);
        } else {
            showError(errorBox, '繝ｭ繧ｰ繧､繝ｳ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・);
        }
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;

    console.log('繧｢繧ｫ繧ｦ繝ｳ繝井ｽ懈・隧ｦ陦・', username);

    if (password.length < 6) {
        showError(document.getElementById('registerError'), '繝代せ繝ｯ繝ｼ繝峨・6譁・ｭ嶺ｻ･荳雁ｿ・ｦ√〒縺吶・);
        return;
    }

    try {
        const email = username + '@forums.local';
        
        // 繝ｦ繝ｼ繧ｶ繝ｼ蜷阪・驥崎､・メ繧ｧ繝・け
        const usersQuery = query(collection(db, 'users'), where('username', '==', username));
        const querySnapshot = await getDocs(usersQuery);
        
        if (!querySnapshot.empty) {
            showError(document.getElementById('registerError'), '縺薙・蜷榊燕縺ｯ譌｢縺ｫ菴ｿ逕ｨ縺輔ｌ縺ｦ縺・∪縺吶・);
            return;
        }

        // 繧｢繧ｫ繧ｦ繝ｳ繝井ｽ懈・
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Firestore縺ｫ繝ｦ繝ｼ繧ｶ繝ｼ諠・ｱ繧剃ｿ晏ｭ・        const isAdmin = username === 'AtsukiGames';
        await setDoc(doc(db, 'users', user.uid), {
            username: username,
            email: email,
            isAdmin: isAdmin,
            createdAt: Timestamp.now()
        });

        await updateProfile(user, { displayName: username });
        console.log('%c 繧｢繧ｫ繧ｦ繝ｳ繝井ｽ懈・謌仙粥:', 'color: #4CAF50; font-weight: bold', username, isAdmin ? '(邂｡逅・・' : '');
        hideAccountModal();
    } catch (error) {
        console.error('繧｢繧ｫ繧ｦ繝ｳ繝井ｽ懈・繧ｨ繝ｩ繝ｼ:', error);
        showError(document.getElementById('registerError'), '繧｢繧ｫ繧ｦ繝ｳ繝井ｽ懈・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        console.log('%c 繝ｭ繧ｰ繧｢繧ｦ繝域・蜉・, 'color: #4CAF50; font-weight: bold');
        hideAccountModal();
    } catch (error) {
        console.error('繝ｭ繧ｰ繧｢繧ｦ繝医お繝ｩ繝ｼ:', error);
        alert('繝ｭ繧ｰ繧｢繧ｦ繝医お繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・);
    }
}

async function handleDeleteAccount() {
    const password = prompt('繧｢繧ｫ繧ｦ繝ｳ繝亥炎髯､縺ｮ縺溘ａ繝代せ繝ｯ繝ｼ繝峨ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞:');
    if (!password) return;

    try {
        const email = currentUserData.username + '@forums.local';
        await signInWithEmailAndPassword(auth, email, password);
        
        // Firestore縺九ｉ繝ｦ繝ｼ繧ｶ繝ｼ繝・・繧ｿ繧貞炎髯､
        await deleteDoc(doc(db, 'users', currentUser.uid));
        
        // Authentication縺九ｉ繝ｦ繝ｼ繧ｶ繝ｼ繧貞炎髯､
        await deleteUser(currentUser);
        
        console.log('%c 繧｢繧ｫ繧ｦ繝ｳ繝亥炎髯､謌仙粥', 'color: #4CAF50; font-weight: bold');
        hideAccountModal();
        alert('繧｢繧ｫ繧ｦ繝ｳ繝医′蜑企勁縺輔ｌ縺ｾ縺励◆縲・);
    } catch (error) {
        console.error('繧｢繧ｫ繧ｦ繝ｳ繝亥炎髯､繧ｨ繝ｩ繝ｼ:', error);
        if (error.code === 'auth/wrong-password') {
            alert('繝代せ繝ｯ繝ｼ繝峨′驕輔＞縺ｾ縺吶・);
        } else {
            alert('繧｢繧ｫ繧ｦ繝ｳ繝亥炎髯､繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・);
        }
    }
}

// ===================================================================
// 繧ｹ繝ｬ繝・ラ邂｡逅・// ===================================================================
async function displayThreads(threads) {
    const container = document.getElementById('threadsContainer');
    
    if (threads.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #999;">繧ｹ繝ｬ繝・ラ縺後≠繧翫∪縺帙ｓ縲・/p>';
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
            console.error('菴懈・閠・ュ蝣ｱ縺ｮ蜿門ｾ励お繝ｩ繝ｼ:', error);
        }

        const date = thread.createdAt?.toDate().toLocaleDateString('ja-JP');
        
        card.innerHTML = `
            ${thread.isPinned ? '<div class="thread-pin-badge">東蝗ｺ螳壹＆繧後※縺・∪縺・/div>' : ''}
            <h3 class="thread-card-title">${escapeHtml(thread.title)}</h3>
            <div class="thread-card-meta">
                <span>菴懈・閠・ ${escapeHtml(creatorName)}</span>
                <span>菴懈・譌･: ${date}</span>
                <span>町 ${thread.messageCount || 0}</span>
            </div>
            <div class="thread-card-tags">
                ${thread.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        `;

        // 繧ｹ繝ｬ繝・ラ繧ｪ繝ｼ繝翫・縺ｾ縺溘・邂｡逅・・・蝣ｴ蜷医√Γ繝九Η繝ｼ繝懊ち繝ｳ繧定ｿｽ蜉
        if (currentUserData && (currentUserData.id === thread.creatorId || currentUserData.isAdmin)) {
            const menuBtn = document.createElement('button');
            menuBtn.className = 'thread-menu-trigger';
            menuBtn.textContent = '窶ｦ';
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
    // 譌｢蟄倥・繝｡繝九Η繝ｼ繧帝哩縺倥ｋ
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
            text: thread.isPinned ? '蝗ｺ螳夊ｧ｣髯､' : '蝗ｺ螳・,
            action: () => togglePin(thread)
        });
        options.push({
            text: thread.isLocked ? '繝ｭ繝・け隗｣髯､' : '繝ｭ繝・け',
            action: () => toggleLock(thread)
        });
    }
    
    options.push({
        text: '蜑企勁',
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

    // 繝｡繝九Η繝ｼ螟悶ｒ繧ｯ繝ｪ繝・け縺励◆繧蛾哩縺倥ｋ
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
            // 譁ｰ縺励￥蝗ｺ螳壹☆繧句ｴ蜷医∵里蟄倥・蝗ｺ螳壹ｒ蜈ｨ縺ｦ隗｣髯､
            const threadsQuery = query(collection(db, 'threads'), where('isPinned', '==', true));
            const pinnedThreads = await getDocs(threadsQuery);
            
            pinnedThreads.forEach((doc) => {
                batch.update(doc.ref, { isPinned: false });
                console.log('譌｢蟄倥・蝗ｺ螳壹ｒ隗｣髯､:', doc.id);
            });
            
            // 譁ｰ縺励＞繧ｹ繝ｬ繝・ラ繧貞崋螳・            batch.update(doc(db, 'threads', thread.id), { isPinned: true });
            console.log('%c 繧ｹ繝ｬ繝・ラ繧貞崋螳・', 'color: #4CAF50; font-weight: bold', thread.title);
        } else {
            // 蝗ｺ螳夊ｧ｣髯､
            batch.update(doc(db, 'threads', thread.id), { isPinned: false });
            console.log('蝗ｺ螳夊ｧ｣髯､:', thread.title);
        }
        
        await batch.commit();
    } catch (error) {
        console.error('蝗ｺ螳壼・繧頑崛縺医お繝ｩ繝ｼ:', error);
        alert('謫堺ｽ懊↓螟ｱ謨励＠縺ｾ縺励◆縲・);
    }
}

async function toggleLock(thread) {
    try {
        await updateDoc(doc(db, 'threads', thread.id), {
            isLocked: !thread.isLocked
        });
        console.log('繝ｭ繝・け迥ｶ諷句､画峩:', thread.title);
    } catch (error) {
        console.error('繝ｭ繝・け蛻・ｊ譖ｿ縺医お繝ｩ繝ｼ:', error);
        alert('謫堺ｽ懊↓螟ｱ謨励＠縺ｾ縺励◆縲・);
    }
}

async function deleteThreadFromList(thread) {
    if (!confirm('縺薙・繧ｹ繝ｬ繝・ラ繧貞炎髯､縺励∪縺吶°・・)) return;

    try {
        await deleteDoc(doc(db, 'threads', thread.id));
        
        // 髢｢騾｣繝｡繝・そ繝ｼ繧ｸ縺ｨ霑比ｿ｡繧ょ炎髯､
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

        console.log('%c 繧ｹ繝ｬ繝・ラ蜑企勁:', 'color: #f44336; font-weight: bold', thread.title);
    } catch (error) {
        console.error('繧ｹ繝ｬ繝・ラ蜑企勁繧ｨ繝ｩ繝ｼ:', error);
        alert('蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);
    }
}

async function handleCreateThread(e) {
    e.preventDefault();
    const title = document.getElementById('threadTitle').value.trim();
    const tags = Array.from(document.getElementById('tagsContainer').children)
        .map(pill => pill.dataset.tag);

    if (!title || tags.length === 0) {
        showError(document.getElementById('createThreadError'), '蜀・ｮｹ縺御ｸ崎ｶｳ縺励※縺・∪縺吶・);
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

        console.log('%c 繧ｹ繝ｬ繝・ラ菴懈・:', 'color: #4CAF50; font-weight: bold', title);
        hideCreateThreadModal();
    } catch (error) {
        console.error('繧ｹ繝ｬ繝・ラ菴懈・繧ｨ繝ｩ繝ｼ:', error);
        showError(document.getElementById('createThreadError'), '繧ｹ繝ｬ繝・ラ菴懈・縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);
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
            showError(document.getElementById('createThreadError'), '繧ｿ繧ｰ縺ｯ5縺､縺ｾ縺ｧ菴懈・縺ｧ縺阪∪縺吶・);
            return;
        }

        const pill = document.createElement('div');
        pill.className = 'tag-pill';
        pill.dataset.tag = tag;
        pill.innerHTML = `
            ${escapeHtml(tag)}
            <button type="button" class="tag-remove">ﾃ・/button>
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
// 繧ｹ繝ｬ繝・ラ隧ｳ邏ｰ陦ｨ遉ｺ
// ===================================================================
async function showThreadDetail(thread) {
    currentThread = thread;
    
    document.querySelector('.main-content').classList.add('hidden');
    document.getElementById('threadDetail').classList.remove('hidden');
    document.getElementById('threadDetailTitle').textContent = thread.title;

    // 繝ｭ繝・け迥ｶ諷九・陦ｨ遉ｺ
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

    // 繝｡繝九Η繝ｼ繝懊ち繝ｳ縺ｮ陦ｨ遉ｺ蛻ｶ蠕｡
    const threadMenuBtn = document.getElementById('threadMenuBtn');
    const threadMenu = document.getElementById('threadMenu');
    
    if (currentUserData && (currentUserData.id === thread.creatorId || currentUserData.isAdmin)) {
        threadMenuBtn.classList.remove('hidden');
        
        const pinBtn = document.getElementById('pinThreadBtn');
        const lockBtn = document.getElementById('lockThreadBtn');
        
        pinBtn.textContent = thread.isPinned ? '蝗ｺ螳夊ｧ｣髯､' : '蝗ｺ螳・;
        lockBtn.textContent = thread.isLocked ? '繝ｭ繝・け隗｣髯､' : '繝ｭ繝・け';
        
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
    if (!confirm('縺薙・繧ｹ繝ｬ繝・ラ繧貞炎髯､縺励∪縺吶°・・)) return;

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

        console.log('%c 繧ｹ繝ｬ繝・ラ蜑企勁:', 'color: #f44336; font-weight: bold', thread.title);
        hideThreadDetail();
    } catch (error) {
        console.error('繧ｹ繝ｬ繝・ラ蜑企勁繧ｨ繝ｩ繝ｼ:', error);
        alert('蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);
    }
}

async function displayMessages(messages) {
    const container = document.getElementById('messagesContainer');
    
    if (messages.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #999;">繝｡繝・そ繝ｼ繧ｸ縺後≠繧翫∪縺帙ｓ縲・/p>';
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
            console.error('菴懈・閠・ュ蝣ｱ縺ｮ蜿門ｾ励お繝ｩ繝ｼ:', error);
        }

        const date = message.createdAt?.toDate().toLocaleString('ja-JP');
        const likeCount = message.likes ? message.likes.length : 0;

        let authorClass = 'message-author';
        let displayName = authorName;
        
        if (isAdmin) {
            authorClass += ' admin';
        } else if (isOwner) {
            authorClass += ' owner';
            displayName = '繧ｹ繝ｬ荳ｻ';
        }

        card.innerHTML = `
            <div class="message-header">
                <span class="${authorClass}">${escapeHtml(displayName)}</span>
                <span class="message-date">${date}</span>
            </div>
            <div class="message-content">${escapeHtml(message.content)}</div>
            <div class="message-actions">
                <button class="message-action-btn like-btn" data-message-id="${message.id}">
                    総 ${likeCount}
                </button>
                <button class="message-action-btn reply-btn" data-message-id="${message.id}">
                    町 ${message.replyCount || 0}
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
        alert('繝ｭ繧ｰ繧､繝ｳ縺悟ｿ・ｦ√〒縺吶・);
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

        console.log('%c 繝｡繝・そ繝ｼ繧ｸ騾∽ｿ｡謌仙粥', 'color: #4CAF50; font-weight: bold');
        document.getElementById('messageInput').value = '';
    } catch (error) {
        console.error('繝｡繝・そ繝ｼ繧ｸ騾∽ｿ｡繧ｨ繝ｩ繝ｼ:', error);
        alert('繝｡繝・そ繝ｼ繧ｸ縺ｮ騾∽ｿ｡縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);
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
        console.error('縺・＞縺ｭ繧ｨ繝ｩ繝ｼ:', error);
    }
}

// ===================================================================
// 霑比ｿ｡讖溯・
// ===================================================================
async function showReplyDetail(message) {
    currentMessage = message;
    
    document.getElementById('threadDetail').classList.add('hidden');
    document.getElementById('replyDetail').classList.remove('hidden');
    document.getElementById('replyDetailTitle').textContent = currentThread.title + ' - 霑比ｿ｡';

    let authorName = 'Unknown';
    try {
        const authorDoc = await getDoc(doc(db, 'users', message.userId));
        if (authorDoc.exists()) {
            authorName = authorDoc.data().username;
        }
    } catch (error) {
        console.error('菴懈・閠・ュ蝣ｱ縺ｮ蜿門ｾ励お繝ｩ繝ｼ:', error);
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
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #999;">霑比ｿ｡縺後≠繧翫∪縺帙ｓ縲・/p>';
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
            console.error('菴懈・閠・ュ蝣ｱ縺ｮ蜿門ｾ励お繝ｩ繝ｼ:', error);
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
        alert('繝ｭ繧ｰ繧､繝ｳ縺悟ｿ・ｦ√〒縺吶・);
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

        console.log('%c 霑比ｿ｡騾∽ｿ｡謌仙粥', 'color: #4CAF50; font-weight: bold');
        document.getElementById('replyInput').value = '';
    } catch (error) {
        console.error('霑比ｿ｡騾∽ｿ｡繧ｨ繝ｩ繝ｼ:', error);
        alert('霑比ｿ｡縺ｮ騾∽ｿ｡縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);
    }
}

// ===================================================================
// 讀懃ｴ｢繝ｻ繧ｽ繝ｼ繝・// ===================================================================
function handleSearch(e) {
    searchQuery = e.target.value;
    console.log('讀懃ｴ｢:', searchQuery);
    setupRealtimeThreadsListener();
}

function toggleSortMenu() {
    document.getElementById('sortMenu').classList.toggle('hidden');
}

function handleSort(sort) {
    currentSort = sort;
    const labels = { new: '譁ｰ隕城・, popular: '莠ｺ豌鈴・, old: '蜿､縺・・ };
    document.getElementById('sortLabel').textContent = labels[sort];
    document.getElementById('sortMenu').classList.add('hidden');
    console.log('繧ｽ繝ｼ繝・', sort);
    setupRealtimeThreadsListener();
}

// ===================================================================
// UI蛻ｶ蠕｡
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
            (currentUserData.isAdmin ? ' (邂｡逅・・' : '');
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
    
    // 繝｡繝・そ繝ｼ繧ｸ繝ｪ繧ｹ繝翫・繧定ｧ｣髯､
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
}

function hideReplyDetail() {
    document.getElementById('replyDetail').classList.add('hidden');
    
    // 霑比ｿ｡繝ｪ繧ｹ繝翫・繧定ｧ｣髯､
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
    if (!text) return "";
    return text
        .replace(/[&<>"']/g, function(match) {
            return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[match];
        })
        .replace(/(\r\n|\n|\r)/g, '<br>');
}[match];
        })
        .replace(/(\r\n|\n|\r)/g, '<br>');
}[match];
        })
        .replace(/(\r\n|\n|\r)/g, '<br>');
}[match];
        })
        .replace(/(\r\n|\n|\r)/g, '<br>');
}[match];
        })
        .replace(/(\r\n|\n|\r)/g, '<br>');
}[match];
        })
        .replace(/(\r\n|\n|\r)/g, '<br>');
}[match];
        })
        .replace(/(\r\n|\n|\r)/g, '<br>');
}[match];
        })
        .replace(/(\r\n|\n|\r)/g, '<br>');
}

// ===================================================================
// 繧ｰ繝ｭ繝ｼ繝舌Ν繧ｯ繝ｪ繝・け繧､繝吶Φ繝茨ｼ医Γ繝九Η繝ｼ繧帝哩縺倥ｋ・・// ===================================================================
document.addEventListener('click', (e) => {
    if (!e.target.closest('.sort-dropdown')) {
        document.getElementById('sortMenu').classList.add('hidden');
    }
    if (!e.target.closest('.thread-menu-btn') && !e.target.closest('.thread-menu')) {
        document.getElementById('threadMenu').classList.add('hidden');
    }
});

// ===================================================================
// 繝壹・繧ｸ髮｢閼ｱ譎ゅ・繧ｯ繝ｪ繝ｼ繝ｳ繧｢繝・・
// ===================================================================
window.addEventListener('beforeunload', () => {
    if (threadsUnsubscribe) threadsUnsubscribe();
    if (messagesUnsubscribe) messagesUnsubscribe();
    if (repliesUnsubscribe) repliesUnsubscribe();
});

console.log('%c Forums 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ蛻晄悄蛹門ｮ御ｺ・, 'color: #4CAF50; font-weight: bold; font-size: 16px');



function setupRealtimeRepliesListener(messageId) {
    if (window.repliesUnsubscribe) window.repliesUnsubscribe();
    const container = document.getElementById('repliesContainer');
    const q = query(collection(db, 'replies'), where('messageId', '==', messageId), orderBy('createdAt', 'asc'));
    window.repliesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const replies = [];
        querySnapshot.forEach(doc => replies.push({ id: doc.id, ...doc.data() }));
        displayReplies(replies);
    });
}

function setupRealtimeRepliesListener(messageId) {
    if (window.repliesUnsubscribe) window.repliesUnsubscribe();
    const container = document.getElementById('repliesContainer');
    const q = query(collection(db, 'replies'), where('messageId', '==', messageId), orderBy('createdAt', 'asc'));
    window.repliesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const replies = [];
        querySnapshot.forEach(doc => replies.push({ id: doc.id, ...doc.data() }));
        displayReplies(replies);
    });
}

function setupRealtimeRepliesListener(messageId) {
    if (window.repliesUnsubscribe) window.repliesUnsubscribe();
    const container = document.getElementById('repliesContainer');
    const q = query(collection(db, 'replies'), where('messageId', '==', messageId), orderBy('createdAt', 'asc'));
    window.repliesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const replies = [];
        querySnapshot.forEach(doc => replies.push({ id: doc.id, ...doc.data() }));
        displayReplies(replies);
    });
}

function setupRealtimeRepliesListener(messageId) {
    if (window.repliesUnsubscribe) window.repliesUnsubscribe();
    const container = document.getElementById('repliesContainer');
    const q = query(collection(db, 'replies'), where('messageId', '==', messageId), orderBy('createdAt', 'asc'));
    window.repliesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const replies = [];
        querySnapshot.forEach(doc => replies.push({ id: doc.id, ...doc.data() }));
        displayReplies(replies);
    });
}

function setupRealtimeRepliesListener(messageId) {
    if (window.repliesUnsubscribe) window.repliesUnsubscribe();
    const container = document.getElementById('repliesContainer');
    const q = query(collection(db, 'replies'), where('messageId', '==', messageId), orderBy('createdAt', 'asc'));
    window.repliesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const replies = [];
        querySnapshot.forEach(doc => replies.push({ id: doc.id, ...doc.data() }));
        displayReplies(replies);
    });
}

function setupRealtimeRepliesListener(messageId) {
    if (window.repliesUnsubscribe) window.repliesUnsubscribe();
    const container = document.getElementById('repliesContainer');
    const q = query(collection(db, 'replies'), where('messageId', '==', messageId), orderBy('createdAt', 'asc'));
    window.repliesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const replies = [];
        querySnapshot.forEach(doc => replies.push({ id: doc.id, ...doc.data() }));
        displayReplies(replies);
    });
}
document.addEventListener('DOMContentLoaded', function() {
    const check = document.getElementById('protectThreadCheck');
    const group = document.getElementById('protectPasswordGroup');
    if (check && group) {
        check.addEventListener('change', function() {
            group.classList.toggle('hidden', !check.checked);
        });
    }
}, false);

function setupRealtimeRepliesListener(messageId) {
    if (window.repliesUnsubscribe) window.repliesUnsubscribe();
    const container = document.getElementById('repliesContainer');
    const q = query(collection(db, 'replies'), where('messageId', '==', messageId), orderBy('createdAt', 'asc'));
    window.repliesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const replies = [];
        querySnapshot.forEach(doc => replies.push({ id: doc.id, ...doc.data() }));
        displayReplies(replies);
    });
}
document.addEventListener('DOMContentLoaded', function() {
    const check = document.getElementById('protectThreadCheck');
    const group = document.getElementById('protectPasswordGroup');
    if (check && group) {
        check.addEventListener('change', function() {
            group.classList.toggle('hidden', !check.checked);
        });
    }
}, false);

function setupRealtimeRepliesListener(messageId) {
    if (window.repliesUnsubscribe) window.repliesUnsubscribe();
    const container = document.getElementById('repliesContainer');
    const q = query(collection(db, 'replies'), where('messageId', '==', messageId), orderBy('createdAt', 'asc'));
    window.repliesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const replies = [];
        querySnapshot.forEach(doc => replies.push({ id: doc.id, ...doc.data() }));
        displayReplies(replies);
    });
}
document.addEventListener('DOMContentLoaded', function() {
    const check = document.getElementById('protectThreadCheck');
    const group = document.getElementById('protectPasswordGroup');
    if (check && group) {
        check.addEventListener('change', function() {
            group.classList.toggle('hidden', !check.checked);
        });
    }
}, false);
