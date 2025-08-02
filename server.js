import express from 'express';
import multer from 'multer';
import fs from 'fs';
import cors from 'cors';
import * as dotenv from 'dotenv';
import mega from 'megajs';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Multer config for handling file uploads
const upload = multer({ dest: 'uploads/' });

// Upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const fileStream = fs.createReadStream(file.path);

    const storage = mega.storage({
      email: process.env.MEGA_EMAIL,
      password: process.env.MEGA_PASS
    }, async (err, storage) => {
      if (err) {
        console.error('MEGA login failed:', err);
        return res.status(500).json({ error: 'Login to MEGA failed' });
      }

      const up = storage.upload(file.originalname, fileStream, (err, file) => {
        fs.unlinkSync(req.file.path); // delete after upload

        if (err) {
          console.error('Upload error:', err);
          return res.status(500).json({ error: 'Upload failed' });
        }

        file.link((err, link) => {
          if (err) {
            console.error('Link error:', err);
            return res.status(500).json({ error: 'Could not get link' });
          }

          return res.status(200).json({ url: link });
        });
      });

      up.on('complete', () => {
        console.log('Upload complete!');
      });
    });

  } catch (e) {
    console.error('Server error:', e);
    res.status(500).json({ error: 'Server crashed' });
  }
});

// Simple ping route
app.get('/', (req, res) => {
  res.send('MEGA Upload API is running.');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
