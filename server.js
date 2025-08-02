require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { File, Storage } = require('megajs');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(cors());
app.use(express.json());

// MEGA storage instance
let storage = null;

// Connect to MEGA
async function connectToMega() {
    try {
        storage = new Storage({
            email: process.env.MEGA_EMAIL,
            password: process.env.MEGA_PASSWORD,
        });

        await storage.ready;
        console.log('Connected to MEGA storage');
    } catch (error) {
        console.error('Error connecting to MEGA:', error);
    }
}

// Upload file to MEGA
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileStream = fs.createReadStream(req.file.path);
        const fileName = req.file.originalname;

        // Upload to MEGA
        const uploadedFile = await storage.upload({
            name: fileName,
            size: req.file.size,
        }).catch(err => {
            throw new Error(`Upload failed: ${err.message}`);
        });

        // Get the streamable link
        const streamUrl = await uploadedFile.link();

        // Clean up temporary file
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            fileName: fileName,
            streamUrl: streamUrl
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get file list from MEGA
app.get('/files', async (req, res) => {
    try {
        const files = await storage.getFiles();
        const fileList = files.map(file => ({
            name: file.name,
            size: file.size,
            id: file.nodeId
        }));

        res.json(fileList);
    } catch (error) {
        console.error('Error getting file list:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get streamable URL for a file
app.get('/stream/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const file = storage.getFile(fileId);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        const streamUrl = await file.link();
        res.json({ streamUrl });
    } catch (error) {
        console.error('Error getting stream URL:', error);
        res.status(500).json({ error: error.message });
    }
});

// Initialize server
const PORT = process.env.PORT || 3000;

// Connect to MEGA and start server
connectToMega().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
