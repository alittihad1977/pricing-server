const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.text({ type: '*/*' }));

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is missing');
    process.exit(1);
}

const bot = new TelegramBot(token, {
    polling: true
});

let lastMessage = '';

bot.on('channel_post', (msg) => {

    const message = msg.text || '';

    if (!message) return;

    lastMessage = message;

    console.log('تم استقبال رسالة جديدة');
    console.log(message);
});

app.get('/msg', (req, res) => {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    res.type('text/plain; charset=utf-8');

    res.send(lastMessage);
});

app.get('/', (req, res) => {
    res.send('Pricing Server is running');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Bot is running...');
});
