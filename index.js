const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
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
   مفاتيح الإشعارات
   ===================================================== */

const VAPID_PUBLIC_KEY =
    process.env.VAPID_PUBLIC_KEY;

const VAPID_PRIVATE_KEY =
    process.env.VAPID_PRIVATE_KEY;

console.log(
    'VAPID_PUBLIC_KEY:',
    VAPID_PUBLIC_KEY
        ? ' موجود ✅'
        : ' غير موجود ❌'
);

console.log(
    'VAPID_PRIVATE_KEY:',
    VAPID_PRIVATE_KEY
        ? ' موجود ✅'
        : ' غير موجود ❌'
);


/* =====================================================
   استقبال Telegram
   ===================================================== */

bot.on('channel_post', (msg) => {

    const message = msg.text || '';

    if (!message) return;

    lastMessage = message;

    console.log('تم استقبال رسالة جديدة');
    console.log(message);

});


/* =====================================================
   الأسعار
   ===================================================== */

app.get('/msg', (req, res) => {

    res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
    );

    res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate'
    );

    res.type('text/plain; charset=utf-8');

    res.send(lastMessage);

});


/* =====================================================
   مفتاح الإشعارات
   ===================================================== */

app.get('/vapidPublicKey', (req, res) => {

    res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
    );

    res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate'
    );

    res.setHeader(
        'Content-Type',
        'application/json; charset=utf-8'
    );

    if (!VAPID_PUBLIC_KEY) {

        return res.status(500).json({
            publicKey: null,
            error: 'VAPID_PUBLIC_KEY is missing'
        });

    }

    res.json({
        publicKey: VAPID_PUBLIC_KEY
    });

});


/* =====================================================
   تسجيل جهاز للإشعارات
   ===================================================== */

let subscriptions = [];


app.post('/subscribe', (req, res) => {

    try {

        const subscription = req.body;

        if (
            !subscription ||
            !subscription.endpoint
        ) {

            return res.status(400).json({
                success: false,
                error: 'Invalid subscription'
            });

        }


        const exists =
            subscriptions.some(
                item =>
                    item.endpoint ===
                    subscription.endpoint
            );


        if (!exists) {

            subscriptions.push(
                subscription
            );

            console.log(
                'تم تسجيل جهاز جديد للإشعارات'
            );

        } else {

            console.log(
                'الجهاز مسجل مسبقاً'
            );

        }


        res.json({
            success: true
        });


    } catch (error) {

        console.error(
            'Subscribe Error:',
            error
        );

        res.status(500).json({
            success: false,
            error: 'Subscribe failed'
        });

    }

});


/* =====================================================
   الأخبار
   ===================================================== */

app.get('/news', async (req, res) => {

    try {

        const feed =
            await parser.parseURL(
                'https://feeds.bbci.co.uk/arabic/rss.xml'
            );

        const news =
            feed.items
                .slice(0, 10)
                .map(item => ({

                    title:
                        item.title || '',

                    link:
                        item.link || '',

                    date:
                        item.pubDate || ''

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
