/**
 * SecureVault Logic
 * Handles Authentication, Encryption, Sync, and Offline Storage
 */

const UI = {
    authScreen: document.getElementById('authScreen'),
    appScreen: document.getElementById('appScreen'),
    syncId: document.getElementById('syncId'),
    securityCode: document.getElementById('securityCode'),
    unlockBtn: document.getElementById('unlockBtn'),
    lockBtn: document.getElementById('lockBtn'),
    noteInput: document.getElementById('noteInput'),
    activeIdDisplay: document.getElementById('activeIdDisplay'),
    lastSaved: document.getElementById('lastSaved'),
    toast: document.getElementById('toast'),
    statusPill: document.getElementById('syncStatus')
};

let currentState = {
    syncId: null,
    securityCode: null,
    lastSyncTime: null,
    localData: null,
    isDirty: false
};

const API_BASE = window.location.origin + '/api';

function showToast(msg) {
    UI.toast.textContent = msg;
    UI.toast.classList.remove('hidden');
    setTimeout(() => UI.toast.classList.add('hidden'), 3000);
}

// --- Sync Logic ---

async function fetchRemoteData() {
    try {
        const hash = await SecureCrypto.getHash(currentState.syncId + currentState.securityCode);
        const res = await fetch(`${API_BASE}/notes/${currentState.syncId}`, {
            headers: { 'x-vault-hash': hash }
        });

        if (res.status === 403) {
            throw new Error("This ID is already taken by someone else.");
        }

        if (res.ok) {
            const data = await res.json();
            return data.encryptedContent;
        }
        return null;
    } catch (e) {
        console.error("Sync failed:", e.message);
        if (e.message.includes("taken")) {
            showToast(e.message);
            location.reload(); // Lock them out
        }
        UI.statusPill.textContent = "Offline Mode";
        UI.statusPill.className = "status-pill status-offline";
        return null;
    }
}

async function sendRemoteData(encrypted) {
    try {
        const hash = await SecureCrypto.getHash(currentState.syncId + currentState.securityCode);
        const res = await fetch(`${API_BASE}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                syncId: currentState.syncId,
                encryptedContent: encrypted,
                hash: hash
            })
        });

        if (res.status === 403) {
            showToast("Failed to sync: This ID is locked to another code.");
            return false;
        }

        UI.statusPill.textContent = "Connected";
        UI.statusPill.className = "status-pill status-online";
        return true;
    } catch (e) {
        UI.statusPill.textContent = "Sync Pending...";
        UI.statusPill.className = "status-pill status-offline";
        return false;
    }
}

// --- App Logic ---

async function unlockVault() {
    const id = UI.syncId.value.trim();
    const code = UI.securityCode.value;

    if (!id || !code) {
        showToast("Please enter both Sync ID and Security Code");
        return;
    }

    UI.unlockBtn.disabled = true;
    UI.unlockBtn.textContent = "Unlocking...";

    currentState.syncId = id;
    currentState.securityCode = code;

    // 1. Try to fetch from cloud
    let encrypted = await fetchRemoteData();

    // 2. If no cloud or error, try local storage
    if (!encrypted) {
        encrypted = localStorage.getItem(`vault_${id}`);
    }

    if (encrypted) {
        try {
            const decrypted = await SecureCrypto.decrypt(encrypted, code);
            UI.noteInput.value = decrypted;
            currentState.localData = decrypted;
        } catch (e) {
            showToast("Wrong Security Code for this Vault");
            UI.unlockBtn.disabled = false;
            UI.unlockBtn.textContent = "Unlock Vault";
            return;
        }
    }

    // Success
    UI.activeIdDisplay.textContent = id;
    UI.authScreen.classList.add('hidden');
    UI.appScreen.classList.remove('hidden');
    UI.noteInput.focus();
}

async function saveAndSync() {
    const content = UI.noteInput.value;
    if (content === currentState.localData) return;

    UI.lastSaved.textContent = "Drafting...";

    // Save locally immediately (even if offline)
    try {
        const encrypted = await SecureCrypto.encrypt(content, currentState.securityCode);
        localStorage.setItem(`vault_${currentState.syncId}`, encrypted);

        // Try to sync to cloud
        UI.lastSaved.textContent = "Syncing...";
        const success = await sendRemoteData(encrypted);

        if (success) {
            UI.lastSaved.textContent = "All changes synced";
            currentState.localData = content;
        } else {
            UI.lastSaved.textContent = "Saved locally (Offline)";
        }
    } catch (e) {
        console.error("Save error", e);
    }
}

// --- Event Listeners ---

UI.unlockBtn.addEventListener('click', unlockVault);

UI.lockBtn.addEventListener('click', () => {
    // Clear sensitive state
    currentState.syncId = null;
    currentState.securityCode = null;
    currentState.localData = null;
    UI.noteInput.value = '';
    UI.appScreen.classList.add('hidden');
    UI.authScreen.classList.remove('hidden');
    UI.unlockBtn.disabled = false;
    UI.unlockBtn.textContent = "Unlock Vault";
});

// Auto-sync after 1 second of inactivity
let debounceTimer;
UI.noteInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    UI.lastSaved.textContent = "Typing...";
    debounceTimer = setTimeout(saveAndSync, 1000);
});

// Manual Sync
document.getElementById('manualSync').addEventListener('click', saveAndSync);

// PWA Offline Ready Notification
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(() => {
        showToast("App is now ready for offline use! You can Add to Home Screen.");
    });
}
