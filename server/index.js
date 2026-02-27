const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(cors());
app.use(bodyParser.json());

// Serve frontend flat files
app.use(express.static(path.join(__dirname, '../public')));

// Initialize flat file DB if not exists
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({}));
}

function readDB() {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// REST API for Encrypted Notes
app.get('/api/notes/:syncId', (req, res) => {
    const db = readDB();
    const note = db[req.params.syncId];
    if (note) {
        res.json(note);
    } else {
        res.status(404).json({ error: 'Vault not found' });
    }
});

app.post('/api/notes', (req, res) => {
    const { syncId, encryptedContent } = req.body;
    if (!syncId || !encryptedContent) {
        return res.status(400).json({ error: 'Missing data' });
    }

    const db = readDB();
    db[syncId] = {
        encryptedContent,
        lastUpdated: new Date().toISOString()
    };
    writeDB(db);

    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Cloud Sync Server running at http://localhost:${PORT}`);
    console.log(`PWA Frontend being served via index.html locally.`);
});
