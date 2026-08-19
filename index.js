const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');

const app = express();

// ===============================
// CORS
// ===============================

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.options('*', cors());

// ===============================
// Body
// ===============================

app.use(express.text({ type: '*/*' }));

// ===============================
// Telegram Bot
// ===============================

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is missing');
    process.exit(1);
}

const bot = new TelegramBot(token, {
    polling: true
});

// ===============================
// آخر رسالة
// ===============================

let lastMessage = '';

// ===============================
// استقبال رسالة Telegram
// ===============================

bot.on('channel_post', (msg) => {

    const message = msg.text || '';

    if (!message) return;

    lastMessage = message;

    console.log('تم استقبال رسالة جديدة');
    console.log(message);
});

// ===============================
// إرسال آخر رسالة للوحة
// ===============================

app.get('/msg', (req, res) => {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    res.type('text/plain; charset=utf-8');

    res.send(lastMessage);
});

// ===============================
// الصفحة الرئيسية
// ===============================

app.get('/', (req, res) => {

    res.send('Pricing Server is running');

});

// ===============================
// تشغيل السيرفر
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);
    console.log('Bot is running...');

});
