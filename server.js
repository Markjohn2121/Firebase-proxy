require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Storage } = require('megajs');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

let storage = null;

// Connect to MEGA
async function connectToMega() {
    return new Promise((resolve, reject) => {
        storage = new Storage({
            email: process.env.MEGA_EMAIL,
            password: process.env.MEGA_PASSWORD,
        });

        storage.on('ready', () => {
            console.log('✅ Connected to MEGA storage');
            resolve();
        });

        storage.on('error', (err) => {
            console.error('❌ MEGA connection error:', err);
            reject(err);
        });
    });
}

// Upload file to MEGA
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileStream = fs.createReadStream(req.file.path);
    const fileName = req.file.originalname;

    try {
        const uploadedFile = storage.upload({
            name: fileName,
            size: req.file.size
        });

        // Pipe file to MEGA
        fileStream.pipe(uploadedFile);

        await new Promise((resolve, reject) => {
            uploadedFile.on('complete', resolve);
            uploadedFile.on('error', reject);
        });

        const streamUrl = await uploadedFile.link();

        // Cleanup
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            fileName: fileName,
            streamUrl: streamUrl
        });

    } catch (error) {
        console.error('Upload error:', error);
        fs.unlinkSync(req.file.path); // Ensure temp file is cleaned up
        res.status(500).json({ error: error.message });
    }
});

// Get all files from MEGA
app.get('/files', async (req, res) => {
    try {
        const files = storage.root.children;
        const fileList = files.map(file => ({
            name: file.name,
            size: file.size,
            id: file.nodeId
        }));

        res.json(fileList);
    } catch (error) {
        console.error('Error getting files:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get streamable link by fileId
app.get('/stream/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const file = storage.root.children.find(f => f.nodeId === fileId);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        const streamUrl = await file.link();
        res.json({ streamUrl });
    } catch (error) {
        console.error('Stream URL error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;

connectToMega().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to start server due to MEGA error:', err);
});
