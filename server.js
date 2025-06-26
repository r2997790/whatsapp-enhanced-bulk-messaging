const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');

const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    delay
} = require('@whiskeysockets/baileys');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const PORT = process.env.PORT || 8080;

// State management
let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let isConnecting = false;
let connectionAttempts = 0;
let lastQRTime = 0;
let authDir = path.join(tmpdir(), 'wa_session_persistent');

// In-memory storage for enhanced features
let contacts = [];
let groups = [];
let templates = [];
let messageLogs = [];

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
}

// Silent logger
const logger = {
    level: 'silent',
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    child: () => logger
};

function canAttemptConnection() {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastQRTime;
    
    if (timeSinceLastAttempt < 10000) {
        console.log('⏳ Cooldown active, skipping connection attempt');
        return false;
    }
    
    if (connectionAttempts >= 5) {
        console.log('🛑 Max connection attempts reached');
        return false;
    }
    
    return true;
}

function resetConnectionState() {
    connectionAttempts = 0;
    lastQRTime = 0;
    qrCodeData = null;
    isConnecting = false;
}

async function connectToWhatsApp() {
    if (isConnecting) {
        console.log('⚠️ Already connecting, ignoring request');
        return;
    }

    if (!canAttemptConnection()) {
        io.emit('connection-status', 'cooldown');
        return;
    }

    try {
        isConnecting = true;
        connectionAttempts++;
        lastQRTime = Date.now();
        
        console.log(`🔄 Connection attempt ${connectionAttempts}/5`);

        if (sock) {
            try {
                sock.end();
                sock = null;
                console.log('🧹 Cleaned up existing socket');
            } catch (e) {}
        }

        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        console.log('🔐 Using persistent auth state');

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: logger,
            browser: ['WhatsApp', 'Desktop', '2.2412.54'],
            connectTimeoutMs: 90000,
            defaultQueryTimeoutMs: 90000,
            keepAliveIntervalMs: 20000,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            fireInitQueries: false,
            emitOwnEvents: false,
            getMessage: async () => ({ conversation: 'hello' })
        });

        console.log('✅ Socket created');

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            console.log('📡 Update:', { 
                connection, 
                qr: !!qr, 
                statusCode,
                attempts: connectionAttempts 
            });

            if (qr && connectionStatus !== 'connected') {
                try {
                    console.log('📱 QR Code generated, scan with WhatsApp app');
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 8,
                        margin: 2,
                        color: { dark: '#000000', light: '#FFFFFF' },
                        errorCorrectionLevel: 'M'
                    });
                    
                    connectionStatus = 'qr-ready';
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    console.log('✅ QR Code sent to all connected clients');
                } catch (error) {
                    console.error('❌ QR error:', error);
                }
            }

            if (connection === 'open') {
                console.log('🎉 CONNECTION SUCCESSFUL!');
                connectionStatus = 'connected';
                qrCodeData = null;
                isConnecting = false;
                resetConnectionState();
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
            } else if (connection === 'connecting') {
                console.log('🔗 Authenticating...');
                connectionStatus = 'connecting';
                io.emit('connection-status', connectionStatus);
                
            } else if (connection === 'close') {
                console.log('🔌 Connection closed:', statusCode);
                
                connectionStatus = 'disconnected';
                isConnecting = false;
                io.emit('connection-status', connectionStatus);
                
                let shouldReconnect = false;
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Logged out - clearing auth');
                    try {
                        const files = fs.readdirSync(authDir);
                        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
                    } catch (e) {}
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log('🔄 Connection replaced - stopping');
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.restartRequired) {
                    console.log('🔄 Restart required');
                    shouldReconnect = connectionAttempts < 3;
                    
                } else if (statusCode === DisconnectReason.badSession) {
                    console.log('❌ Bad session - clearing auth');
                    try {
                        const files = fs.readdirSync(authDir);
                        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
                    } catch (e) {}
                    shouldReconnect = connectionAttempts < 2;
                    
                } else {
                    console.log('❓ Authentication or unknown failure');
                    shouldReconnect = false;
                }

                qrCodeData = null;
                io.emit('qr-code', null);

                if (shouldReconnect) {
                    console.log('🔄 Will retry in 8 seconds...');
                    setTimeout(() => {
                        connectToWhatsApp();
                    }, 8000);
                } else {
                    console.log('⏹️ Stopping auto-reconnection. Manual retry required.');
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async (m) => {
            console.log('📩 Message received - connection active');
        });

    } catch (error) {
        console.error('❌ Setup error:', error);
        connectionStatus = 'error';
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
    }
}

function manualReset() {
    console.log('🔄 Manual reset initiated');
    
    if (sock) {
        try {
            sock.end();
            sock = null;
        } catch (e) {}
    }
    
    try {
        const files = fs.readdirSync(authDir);
        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
        console.log('🧹 Auth directory cleared');
    } catch (e) {}
    
    resetConnectionState();
    connectionStatus = 'disconnected';
    qrCodeData = null;
    
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
}

// DIAGNOSTIC ROUTE TO CHECK FILE STATUS
app.get('/debug', (req, res) => {
    try {
        const indexPath = path.join(__dirname, 'index.html');
        const testPath = path.join(__dirname, 'test.html');
        
        const indexExists = fs.existsSync(indexPath);
        const testExists = fs.existsSync(testPath);
        
        let indexStats = null;
        let testStats = null;
        let indexPreview = null;
        let testPreview = null;
        
        if (indexExists) {
            indexStats = fs.statSync(indexPath);
            indexPreview = fs.readFileSync(indexPath, 'utf8').substring(0, 200);
        }
        
        if (testExists) {
            testStats = fs.statSync(testPath);
            testPreview = fs.readFileSync(testPath, 'utf8').substring(0, 200);
        }
        
        res.json({
            timestamp: new Date().toISOString(),
            indexHtml: {
                exists: indexExists,
                size: indexStats?.size,
                modified: indexStats?.mtime,
                preview: indexPreview
            },
            testHtml: {
                exists: testExists,
                size: testStats?.size,
                modified: testStats?.mtime,
                preview: testPreview
            },
            workingDirectory: process.cwd(),
            files: fs.readdirSync(__dirname).filter(f => f.endsWith('.html'))
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Routes
app.get('/', (req, res) => {
    try {
        console.log('📄 Serving index.html from:', path.join(__dirname, 'index.html'));
        res.sendFile(path.join(__dirname, 'index.html'));
    } catch (error) {
        console.error('❌ Error serving index.html:', error);
        res.status(500).send('Error loading page');
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: connectionStatus,
        attempts: connectionAttempts,
        timestamp: new Date().toISOString(),
        contacts: contacts.length,
        groups: groups.length,
        templates: templates.length,
        logs: messageLogs.length
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: connectionStatus,
        hasQR: !!qrCodeData,
        isConnecting: isConnecting,
        attempts: connectionAttempts,
        canAttempt: canAttemptConnection()
    });
});

app.post('/api/connect', (req, res) => {
    console.log('🔌 Connect API called');
    connectToWhatsApp();
    res.json({ success: true, message: 'Connection initiated' });
});

app.post('/api/reset', (req, res) => {
    manualReset();
    res.json({ success: true, message: 'Connection reset' });
});

// Enhanced messaging API
app.post('/api/send-message', async (req, res) => {
    try {
        const { number, message } = req.body;
        
        if (!sock || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        let formattedNumber = number.toString().replace(/[^\d]/g, '');
        if (!formattedNumber.includes('@')) {
            formattedNumber = `${formattedNumber}@s.whatsapp.net`;
        }

        await sock.sendMessage(formattedNumber, { text: message });
        
        messageLogs.push({
            id: Date.now(),
            number: number,
            message: message,
            timestamp: new Date(),
            status: 'sent',
            type: 'single'
        });

        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// ENHANCED BULK MESSAGING API
app.post('/api/send-bulk', async (req, res) => {
    try {
        const { numbers, message } = req.body;
        
        if (!sock || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        if (!Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({ error: 'Numbers array is required' });
        }

        if (numbers.length > 50) {
            return res.status(400).json({ error: 'Maximum 50 numbers allowed per bulk send' });
        }

        const results = [];
        
        for (const number of numbers) {
            try {
                let formattedNumber = number.toString().replace(/[^\d]/g, '');
                if (!formattedNumber.includes('@')) {
                    formattedNumber = `${formattedNumber}@s.whatsapp.net`;
                }

                await sock.sendMessage(formattedNumber, { text: message });
                results.push({ number, success: true });
                
                messageLogs.push({
                    id: Date.now() + Math.random(),
                    number: number,
                    message: message,
                    timestamp: new Date(),
                    status: 'sent',
                    type: 'bulk'
                });
                
                if (numbers.length > 1) {
                    await delay(2000);
                }
            } catch (error) {
                results.push({ number, success: false, error: error.message });
                
                messageLogs.push({
                    id: Date.now() + Math.random(),
                    number: number,
                    message: message,
                    timestamp: new Date(),
                    status: 'failed',
                    type: 'bulk',
                    error: error.message
                });
            }
        }
        
        res.json({ 
            success: true, 
            message: 'Bulk send completed',
            results: results 
        });
    } catch (error) {
        console.error('Bulk send error:', error);
        res.status(500).json({ error: 'Failed to send bulk messages' });
    }
});

// Socket.io
io.on('connection', (socket) => {
    console.log(`👤 Client connected: ${socket.id}`);
    
    socket.emit('connection-status', connectionStatus);
    if (qrCodeData) {
        socket.emit('qr-code', qrCodeData);
    }

    socket.on('connect-whatsapp', () => {
        console.log('🔌 Client requested connection');
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            if (canAttemptConnection()) {
                connectToWhatsApp();
            } else {
                socket.emit('connection-status', 'cooldown');
            }
        }
    });

    socket.on('reset-connection', () => {
        console.log('🔄 Client requested reset');
        manualReset();
    });

    socket.on('disconnect', () => {
        console.log(`👋 Client disconnected: ${socket.id}`);
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Enhanced WhatsApp Messaging Server running on port ${PORT}`);
    console.log(`📱 Node: ${process.version}`);
    console.log('⏳ Ready - anti-loop protection enabled');
    console.log('📊 Enhanced features: Contacts, Groups, Templates, Logs');
    console.log('🎯 BULK MESSAGING ACTIVATED - Ready for deployment!');
    console.log('🔍 Debug endpoint available at /debug');
    console.log('');
});
