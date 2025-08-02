require('dotenv').config();
const express = require('express');
const multer = require('multer');
const mega = require('megajs'); // Corrected import
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

// Initialize Mega storage
const storage = new mega.Storage({
  email: process.env.MEGA_EMAIL,
  password: process.env.MEGA_PASSWORD,
  autologin: false
});

// File type detection
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const audioExts = ['.mp3', '.wav', '.ogg', '.m4a'];
  const videoExts = ['.mp4', '.webm', '.mov', '.avi'];
  return audioExts.includes(ext) ? 'audio' : videoExts.includes(ext) ? 'video' : 'other';
}

// Upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    await storage.login();

    const tempPath = `temp_${Date.now()}_${req.file.originalname}`;
    fs.writeFileSync(tempPath, req.file.buffer);

    const file = await storage.upload(tempPath, {
      name: req.file.originalname
    }).complete;

    const url = await file.link();
    fs.unlinkSync(tempPath);

    res.json({
      success: true,
      url: url,
      filename: req.file.originalname,
      type: getFileType(req.file.originalname),
      size: req.file.size
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List files endpoint
app.get('/files', async (req, res) => {
  try {
    await storage.login();
    const root = await storage.root;
    const files = await root.children;

    const fileList = [];
    for (const file of files) {
      if (file.directory) continue;
      
      const url = await file.link();
      fileList.push({
        name: file.name,
        url: url,
        type: getFileType(file.name),
        size: file.size,
        date: new Date(file.timestamp * 1000).toLocaleString()
      });
    }

    res.json({ success: true, files: fileList });
  } catch (err) {
    console.error('File list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
