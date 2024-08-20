const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const admin = require('firebase-admin');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const { v4: uuidv4 } = require('uuid');

// Initialize Firebase Admin SDK
const serviceAccount = require('./upix465-firebase-adminsdk-e1710-1228419d53.json');  // Ensure this path is correct

initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'upix465.appspot.com'
});

const bucket = getStorage().bucket();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const ADMIN_PASSWORD = 'felo1'; // Replace with a strong password

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'admin-post', 'public')));
// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Ensure 'uploads' directory exists (if you still need local storage)
const uploadDir = path.join(__dirname, 'admin-post', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up multer storage (for local storage backup, optional)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // Save images directly in admin-post/public/uploads/
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Error: File type not supported!'));
    }
});

// Middleware to check admin password
const verifyAdminPassword = (req, res, next) => {
    const adminPassword = req.headers['admin-password'];
    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).send('Permission denied: Incorrect admin password.');
    }
    next();
};

// Endpoint to verify admin password
app.post('/verify-password', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.status(200).send({ message: 'Login successful' });
    } else {
        res.status(403).send({ message: 'Incorrect admin password' });
    }
});

// Endpoint to upload images
app.post('/upload', verifyAdminPassword, upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const imagesFilePath = path.join(__dirname, 'admin-post', 'images.json');
    let images = [];

    if (fs.existsSync(imagesFilePath)) {
        images = JSON.parse(fs.readFileSync(imagesFilePath, 'utf8'));
    }

    try {
        const blob = bucket.file(uuidv4() + '-' + req.file.originalname);
        const blobStream = blob.createWriteStream({
            metadata: {
                contentType: req.file.mimetype,
            },
        });

        blobStream.on('error', (err) => {
            console.error('Upload error:', err);
            res.status(500).send({ message: 'Upload failed' });
        });

        blobStream.on('finish', async () => {
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
            images.push(publicUrl);
            fs.writeFileSync(imagesFilePath, JSON.stringify(images));

            console.log('Image uploaded to Firebase Storage:', publicUrl);
            res.status(200).send({ url: publicUrl });
        });

        blobStream.end(req.file.buffer);
    } catch (error) {
        console.error('Error uploading image to Firebase:', error);
        res.status(500).send({ message: 'Firebase upload failed' });
    }
});

// Endpoint to delete images
app.delete('/delete/:filename', verifyAdminPassword, async (req, res) => {
    const filename = req.params.filename;
    const imagesFilePath = path.join(__dirname, 'admin-post', 'images.json');

    if (!fs.existsSync(imagesFilePath)) {
        return res.status(500).send('Image database file not found.');
    }

    let images = JSON.parse(fs.readFileSync(imagesFilePath, 'utf8'));
    const imageIndex = images.findIndex((url) => url.includes(filename));

    if (imageIndex === -1) {
        return res.status(404).send('Image not found in database.');
    }

    try {
        const file = bucket.file(filename);
        await file.delete();

        images.splice(imageIndex, 1);
        fs.writeFileSync(imagesFilePath, JSON.stringify(images));

        console.log('Image deleted from Firebase Storage:', filename);
        res.status(200).send('Image deleted.');
    } catch (error) {
        console.error('Error deleting image from Firebase:', error);
        res.status(500).send('Image deletion failed.');
    }
});

// Endpoint to get images
app.get('/images', (req, res) => {
    const imagesFilePath = path.join(__dirname, 'admin-post', 'images.json');
    let images = fs.existsSync(imagesFilePath) ? JSON.parse(fs.readFileSync(imagesFilePath, 'utf8')) : [];
    res.status(200).json(images);
});

// Endpoint to download images from Firebase Storage
app.get('/download/:filename', verifyAdminPassword, async (req, res) => {
    const filename = req.params.filename;
    const downloadDestination = path.join(__dirname, 'downloads', filename);

    try {
        await bucket.file(filename).download({ destination: downloadDestination });
        res.download(downloadDestination);
        console.log('File downloaded successfully:', downloadDestination);
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).send('File download failed.');
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'loading.html'));
});

// Static files for Fullmotion
app.use('/fullmotion', express.static(path.join(__dirname, 'fullmotion')));

// Serve Admin Application
app.use('/admin', express.static(path.join(__dirname, 'admin-post')));

// Serve Chat Application
app.use('/chat', express.static(path.join(__dirname, 'chatmsgs-pro', 'public')));
app.use('/chat', express.static(path.join(__dirname, 'chatmsgs-pro')));

// Socket.io for chat application
let messages = [];

app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('login', (username) => {
        socket.username = username;
        socket.emit('loadMessages', messages);
    });

    socket.on('sendMessage', (data) => {
        messages.push(data);
        io.emit('receiveMessage', data);
    });

    socket.on('loadMessages', () => {
        socket.emit('loadMessages', messages);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
