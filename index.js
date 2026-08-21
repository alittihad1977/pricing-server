const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');

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

const parser = new Parser();

let lastMessage = '';

/* =====================================================
   استقبال رسائل Telegram
   ===================================================== */

bot.on('channel_post', (msg) => {

    const message = msg.text || '';

    if (!message) return;

    lastMessage = message;

    console.log('تم استقبال رسالة جديدة');
    console.log(message);

});


/* =====================================================
   نظام الأسعار
   ===================================================== */

app.get('/msg', (req, res) => {

    res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
    );

    res.setHeader(
        'Cache-Control',
        'no-store'
    );

    res.type('text/plain; charset=utf-8');

    res.send(lastMessage);

});


/* =====================================================
   نظام الأخبار
   ===================================================== */

app.get('/news', async (req, res) => {

    try {

        const feed = await parser.parseURL(
            'https://feeds.bbci.co.uk/arabic/rss.xml'
        );

        const news = feed.items
            .slice(0, 10)
            .map(item => ({

                title: item.title || '',

                link: item.link || '',

                date: item.pubDate || ''

            }));

        res.setHeader(
            'Cache-Control',
            'no-store'
        );

        res.json(news);

    } catch (error) {

        console.error(
            'News RSS Error:',
            error
        );

        res.status(500).json({

            error: 'News unavailable'

        });

    }

});


/* =====================================================
   الصفحة الرئيسية
   ===================================================== */

app.get('/', (req, res) => {

    res.send(
        'Pricing Server is running'
    );

});


/* =====================================================
   تشغيل السيرفر
   ===================================================== */

const PORT =
    process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );

    console.log(
        'Bot is running...'
    );

    console.log(
        'News system is ready...'
    );

});
