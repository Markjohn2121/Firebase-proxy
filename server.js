require('dotenv').config();
const express = require('express');
const multer = require('multer');
const Mega = require('mega');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() }); // No disk storage needed

// CORS setup (allow requests from any frontend)
app.use(cors({
  origin: '*', // Allow all origins (replace with your frontend URL in production)
  methods: ['GET', 'POST'],
}));

// Mega client setup
const mega = Mega({
  email: process.env.MEGA_EMAIL,
  password: process.env.MEGA_PASSWORD
});

// Helper: Detect if file is audio/video
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const audioExts = ['.mp3', '.wav', '.ogg', '.m4a'];
  const videoExts = ['.mp4', '.webm', '.mov', '.avi'];
  return audioExts.includes(ext) ? 'audio' : videoExts.includes(ext) ? 'video' : 'other';
}

// Upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Log in to Mega
    await mega.login();

    // Create temp file (Render has ephemeral storage)
    const tempPath = `temp_${Date.now()}_${req.file.originalname}`;
    fs.writeFileSync(tempPath, req.file.buffer);

    // Upload to Mega
    const file = await mega.upload(tempPath, req.file.originalname);
    const url = await mega.getDownloadLink(file);

    // Clean up temp file
    fs.unlinkSync(tempPath);

    res.json({
      success: true,
      url: url,
      filename: req.file.originalname,
      type: getFileType(req.file.originalname),
      size: req.file.size,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List files endpoint
app.get('/files', async (req, res) => {
  try {
    await mega.login();
    const files = await mega.getFiles();

    const fileList = [];
    for (const file of files) {
      if (file.type === 'file') {
        const url = await mega.getDownloadLink(file);
        fileList.push({
          name: file.name,
          url: url,
          type: getFileType(file.name),
          size: file.size,
          date: new Date(file.timestamp * 1000).toLocaleString(),
        });
      }
    }

    res.json({ success: true, files: fileList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check (required for Render)
app.get('/health', (req, res) => res.send('OK'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
