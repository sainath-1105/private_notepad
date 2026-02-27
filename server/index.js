const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 4000;

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
let dbConnected = false;

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => {
            console.log('Connected to MongoDB Atlas');
            dbConnected = true;
        })
        .catch(err => {
            console.error('MongoDB connection error:', err.message);
        });
} else {
    console.warn('WARNING: MONGODB_URI is not set. Cloud storage will not work.');
}

// Vault Schema
const VaultSchema = new mongoose.Schema({
    syncId: { type: String, unique: true, required: true },
    encryptedContent: { type: String, required: true },
    hash: { type: String, required: true },
    lastUpdated: { type: Date, default: Date.now }
});

const Vault = mongoose.model('Vault', VaultSchema);

app.use(cors());
app.use(bodyParser.json());

// Serve frontend flat files
app.use(express.static(path.join(__dirname, '../public')));

// REST API for Encrypted Notes
app.get('/api/notes/:syncId', async (req, res) => {
    if (!dbConnected) {
        return res.status(503).json({ error: 'Database not connected. Please check MONGODB_URI on Render.' });
    }
    const hash = req.headers['x-vault-hash'];

    try {
        const vault = await Vault.findOne({ syncId: req.params.syncId });

        if (vault) {
            if (vault.hash === hash) {
                res.json(vault);
            } else {
                res.status(403).json({ error: 'This Sync ID is already taken.' });
            }
        } else {
            res.status(404).json({ error: 'Vault not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.post('/api/notes', async (req, res) => {
    if (!dbConnected) {
        return res.status(503).json({ error: 'Database not connected. Please check MONGODB_URI on Render.' });
    }
    const { syncId, encryptedContent, hash } = req.body;
    if (!syncId || !encryptedContent || !hash) {
        return res.status(400).json({ error: 'Missing data' });
    }

    try {
        let vault = await Vault.findOne({ syncId });

        if (vault && vault.hash !== hash) {
            return res.status(403).json({ error: 'Locked to another code.' });
        }

        if (vault) {
            vault.encryptedContent = encryptedContent;
            vault.lastUpdated = Date.now();
            await vault.save();
        } else {
            await Vault.create({ syncId, encryptedContent, hash });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Storage error', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Cloud Sync Server running at http://localhost:${PORT}`);
    console.log(`PWA Frontend being served via index.html locally.`);
});
