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
    statusPill: document.getElementById('syncStatus'),
    saveExitBtn: document.getElementById('saveExitBtn'),
    deleteVaultBtn: document.getElementById('deleteVaultBtn')
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

        if (res.status === 503) {
            const err = await res.json();
            UI.statusPill.textContent = "DB Error: " + (err.details ? err.details.substring(0, 15) : "Offline");
            UI.statusPill.className = "status-pill status-offline";
            if (err.details) showToast("Cloud Error: " + err.details);
            return null;
        }

        if (res.ok) {
            const data = await res.json();
            UI.statusPill.textContent = "Connected";
            UI.statusPill.className = "status-pill status-online";
            return data.encryptedContent;
        }

        if (res.status === 404) {
            // New Vault - This is a success!
            UI.statusPill.textContent = "Connected";
            UI.statusPill.className = "status-pill status-online";
            return null;
        }

        // Catch-all for other errors (e.g. 500)
        UI.statusPill.textContent = "Sync Error: " + res.status;
        UI.statusPill.className = "status-pill status-offline";
        return null;
    } catch (e) {
        console.error("Sync failed:", e.message);
        if (e.message.includes("taken")) {
            showToast(e.message);
            location.reload();
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

        if (res.status === 503) {
            const err = await res.json();
            UI.statusPill.textContent = "DB Error: " + (err.details ? err.details.substring(0, 15) : "Offline");
            UI.statusPill.className = "status-pill status-offline";
            return false;
        }

        if (res.ok) {
            UI.statusPill.textContent = "Connected";
            UI.statusPill.className = "status-pill status-online";
            return true;
        }

        UI.statusPill.textContent = "Sync Error: " + res.status;
        UI.statusPill.className = "status-pill status-offline";
        return false;
    } catch (e) {
        UI.statusPill.textContent = "Sync Pending...";
        UI.statusPill.className = "status-pill status-offline";
        return false;
    }
}

async function deleteRemoteVault() {
    try {
        const hash = await SecureCrypto.getHash(currentState.syncId + currentState.securityCode);
        const res = await fetch(`${API_BASE}/notes/${currentState.syncId}`, {
            method: 'DELETE',
            headers: { 'x-vault-hash': hash }
        });

        if (res.ok) {
            return true;
        }
        const err = await res.json();
        showToast(err.error || "Delete failed");
        return false;
    } catch (e) {
        showToast("Cannot delete while offline");
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
            UI.lastSaved.textContent = "Last sync: " + new Date().toLocaleTimeString();
        } catch (e) {
            showToast("Wrong Security Code for this Vault");
            UI.unlockBtn.disabled = false;
            UI.unlockBtn.textContent = "Unlock Vault";
            return;
        }
    } else {
        UI.noteInput.value = '';
        currentState.localData = '';
    }

    // Success
    UI.activeIdDisplay.textContent = id;
    UI.authScreen.classList.add('hidden');
    UI.appScreen.classList.remove('hidden');
    UI.noteInput.focus();
}

async function saveAndSync() {
    const content = UI.noteInput.value;
    if (content === currentState.localData) return true;

    UI.lastSaved.textContent = "Drafting...";

    try {
        const encrypted = await SecureCrypto.encrypt(content, currentState.securityCode);
        localStorage.setItem(`vault_${currentState.syncId}`, encrypted);

        UI.lastSaved.textContent = "Syncing...";
        const success = await sendRemoteData(encrypted);

        if (success) {
            UI.lastSaved.textContent = "All changes synced";
            currentState.localData = content;
            return true;
        } else {
            UI.lastSaved.textContent = "Saved locally (Offline)";
            return false;
        }
    } catch (e) {
        console.error("Save error", e);
        return false;
    }
}

function lockVault() {
    currentState.syncId = null;
    currentState.securityCode = null;
    currentState.localData = null;
    UI.noteInput.value = '';
    UI.appScreen.classList.add('hidden');
    UI.authScreen.classList.remove('hidden');
    UI.unlockBtn.disabled = false;
    UI.unlockBtn.textContent = "Unlock Vault";
}

// --- Event Listeners ---

UI.unlockBtn.addEventListener('click', unlockVault);

UI.lockBtn.addEventListener('click', lockVault);

UI.saveExitBtn.addEventListener('click', async () => {
    UI.saveExitBtn.disabled = true;
    UI.saveExitBtn.textContent = "Saving...";
    await saveAndSync();
    lockVault();
    UI.saveExitBtn.disabled = false;
    UI.saveExitBtn.textContent = "Save & Exit";
});

UI.deleteVaultBtn.addEventListener('click', async () => {
    if (!confirm("Are you sure? This will delete your notepad FROM THE CLOUD and your password lock. This cannot be undone.")) return;

    UI.deleteVaultBtn.disabled = true;
    UI.deleteVaultBtn.textContent = "Deleting...";

    const success = await deleteRemoteVault();
    if (success) {
        localStorage.removeItem(`vault_${currentState.syncId}`);
        showToast("Vault deleted successfully");
        lockVault();
    }

    UI.deleteVaultBtn.disabled = false;
    UI.deleteVaultBtn.textContent = "Delete Notepad";
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
