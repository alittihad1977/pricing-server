const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const webpush = require('web-push');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.text({ type: '*/*' }));


/* =====================================================
   Telegram
   ===================================================== */

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is missing');
    process.exit(1);
}

const bot = new TelegramBot(token, {
    polling: true
});


/* =====================================================
   RSS
   ===================================================== */

const parser = new Parser({
    timeout: 15000,
    headers: {
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
    }
});


/* =====================================================
   آخر رسالة أسعار
   ===================================================== */

let lastMessage = '';


/* =====================================================
   رابط لوحة الأسعار
   ===================================================== */

const PRICING_PAGE =
    'https://alittihad1977.github.io/pricing-server/asd.html';


/* =====================================================
   مفاتيح VAPID
   ===================================================== */

const VAPID_PUBLIC_KEY =
    (process.env.VAPID_PUBLIC_KEY || '')
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/=+$/g, '');

const VAPID_PRIVATE_KEY =
    (process.env.VAPID_PRIVATE_KEY || '')
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/=+$/g, '');


console.log(
    'VAPID_PUBLIC_KEY:',
    VAPID_PUBLIC_KEY
        ? 'موجود ✅'
        : 'غير موجود ❌'
);

console.log(
    'VAPID_PRIVATE_KEY:',
    VAPID_PRIVATE_KEY
        ? 'موجود ✅'
        : 'غير موجود ❌'
);


/* =====================================================
   Web Push
   ===================================================== */

if (
    VAPID_PUBLIC_KEY &&
    VAPID_PRIVATE_KEY
) {

    try {

        webpush.setVapidDetails(
            'mailto:admin@pricing-server.com',
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );

        console.log(
            'Web Push جاهز 🔔'
        );

    } catch (error) {

        console.error(
            'VAPID Error:',
            error.message
        );

    }

}


/* =====================================================
   الأجهزة المسجلة
   ===================================================== */

let subscriptions = [];


/* =====================================================
   إرسال الإشعار
   ===================================================== */

async function sendPushNotification(message) {

    if (
        !VAPID_PUBLIC_KEY ||
        !VAPID_PRIVATE_KEY
    ) {

        console.error(
            'لا يمكن إرسال الإشعار: مفاتيح VAPID غير موجودة'
        );

        return;

    }


    if (
        subscriptions.length === 0
    ) {

        console.log(
            'لا توجد أجهزة مسجلة للإشعارات'
        );

        return;

    }


    const notificationData = {

        title:
            'شركة الاتحاد 💰',

        body:
            'تم تحديث أسعار الصرف 🔔',

        icon:
            'https://i.postimg.cc/wvrQMV5X/IMG-20250610-WA0000.png',

        badge:
            'https://i.postimg.cc/wvrQMV5X/IMG-20250610-WA0000.png',

        tag:
            'al-ittihad-prices',

        renotify:
            true,

        requireInteraction:
            false,

        data: {

            url:
                PRICING_PAGE

        }

    };


    const payload =
        JSON.stringify(
            notificationData
        );


    const activeSubscriptions = [];


    for (
        const subscription
        of subscriptions
    ) {

        try {

            await webpush.sendNotification(
                subscription,
                payload
            );


            console.log(
                'تم إرسال الإشعار بنجاح 🔔'
            );


            activeSubscriptions.push(
                subscription
            );


        } catch (error) {

            console.error(
                'Push Error:',
                error.statusCode,
                error.message
            );


            if (
                error.statusCode !== 404 &&
                error.statusCode !== 410
            ) {

                activeSubscriptions.push(
                    subscription
                );

            }

        }

    }


    subscriptions =
        activeSubscriptions;


    console.log(
        'عدد الأجهزة المسجلة حالياً:',
        subscriptions.length
    );

}


/* =====================================================
   استقبال رسائل Telegram
   ===================================================== */

bot.on(
    'channel_post',
    async (msg) => {

        const message =
            msg.text || '';


        if (!message) {
            return;
        }


        if (
            message === lastMessage
        ) {

            return;

        }


        lastMessage =
            message;


        console.log(
            'تم استقبال رسالة جديدة'
        );

        console.log(
            message
        );


        await sendPushNotification(
            message
        );

    }
);


/* =====================================================
   نظام الأسعار
   ===================================================== */

app.get(
    '/msg',
    (req, res) => {

        res.setHeader(
            'Access-Control-Allow-Origin',
            '*'
        );

        res.setHeader(
            'Cache-Control',
            'no-store, no-cache, must-revalidate'
        );

        res.type(
            'text/plain; charset=utf-8'
        );

        res.send(
            lastMessage
        );

    }
);


/* =====================================================
   مفتاح VAPID العام
   ===================================================== */

app.get(
    '/vapidPublicKey',
    (req, res) => {

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


        if (
            !VAPID_PUBLIC_KEY
        ) {

            return res.status(500).json({

                publicKey:
                    null,

                error:
                    'VAPID_PUBLIC_KEY is missing'

            });

        }


        res.json({

            publicKey:
                VAPID_PUBLIC_KEY

        });

    }
);


/* =====================================================
   تسجيل جهاز للإشعارات
   ===================================================== */

app.post(
    '/subscribe',
    (req, res) => {

        try {

            const subscription =
                req.body;


            if (
                !subscription ||
                !subscription.endpoint
            ) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        'Invalid subscription'

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
                    '📱 تم تسجيل جهاز جديد'
                );

            } else {

                console.log(
                    '📱 الجهاز مسجل مسبقاً'
                );

            }


            console.log(
                'عدد الأجهزة المسجلة:',
                subscriptions.length
            );


            res.json({

                success:
                    true,

                devices:
                    subscriptions.length

            });


        } catch (error) {

            console.error(
                'Subscribe Error:',
                error
            );


            res.status(500).json({

                success:
                    false,

                error:
                    'Subscribe failed'

            });

        }

    }
);


/* =====================================================
   مصادر الأخبار
   ===================================================== */

const NEWS_FEEDS = [

    {
        name:
            'BBC Arabic',

        url:
            'https://feeds.bbci.co.uk/arabic/rss.xml'
    },

    {
        name:
            'الشرق الأوسط - كل الأخبار',

        url:
            'https://aawsat.com/feed/news'
    },

    {
        name:
            'الشرق الأوسط - الاقتصاد',

        url:
            'https://aawsat.com/feed/economy'
    },

    {
        name:
            'الشرق الأوسط - الرياضة',

        url:
            'https://aawsat.com/feed/sport'
    }

];


/* =====================================================
   جلب الأخبار من مصدر واحد
   ===================================================== */

async function fetchNewsFeed(feed) {

    console.log('');
    console.log('--------------------------------------');

    console.log(
        '🔎 المصدر:',
        feed.name
    );

    console.log(
        '🔗 الرابط:',
        feed.url
    );


    try {

        const result =
            await parser.parseURL(
                feed.url
            );


        const items =
            result.items || [];


        console.log(
            '✅ نجح المصدر:',
            feed.name
        );

        console.log(
            '📰 عدد الأخبار:',
            items.length
        );


        const news =
            items
                .slice(0, 10)
                .map(
                    item => ({

                        title:
                            (item.title || '').trim(),

                        link:
                            item.link || '',

                        date:
                            item.pubDate ||
                            item.isoDate ||
                            '',

                        source:
                            feed.name

                    })
                )
                .filter(
                    item =>
                        item.title
                );


        console.log(
            '📥 الأخبار المقبولة:',
            news.length
        );


        return news;


    } catch (error) {

        console.error(
            '❌ فشل المصدر:',
            feed.name
        );

        console.error(
            '❌ الخطأ:',
            error.message
        );


        return [];

    }

}


/* =====================================================
   الأخبار
   ===================================================== */

app.get(
    '/news',
    async (req, res) => {

        console.log('');
        console.log('');
        console.log('======================================');
        console.log('📰 بدء فحص جميع مصادر الأخبار');
        console.log('======================================');


        try {

            const results =
                await Promise.all(
                    NEWS_FEEDS.map(
                        feed =>
                            fetchNewsFeed(
                                feed
                            )
                    )
                );


            const allNews =
                results.flat();


            console.log('');
            console.log(
                '📊 مجموع الأخبار قبل إزالة التكرار:',
                allNews.length
            );


            /* =========================================
               إزالة الأخبار المكررة
               ========================================= */

            const uniqueNews = [];

            const seenTitles =
                new Set();


            for (
                const item
                of allNews
            ) {

                const key =
                    item.title
                        .toLowerCase()
                        .replace(/\s+/g, ' ')
                        .trim();


                if (
                    !seenTitles.has(
                        key
                    )
                ) {

                    seenTitles.add(
                        key
                    );

                    uniqueNews.push(
                        item
                    );

                }

            }


            console.log(
                '📊 مجموع الأخبار بعد إزالة التكرار:',
                uniqueNews.length
            );


            /* =========================================
               ترتيب الأخبار من الأحدث إلى الأقدم
               ========================================= */

            uniqueNews.sort(
                (a, b) => {

                    const dateA =
                        new Date(
                            a.date || 0
                        ).getTime();

                    const dateB =
                        new Date(
                            b.date || 0
                        ).getTime();


                    return dateB - dateA;

                }
            );


            /* =========================================
               إرسال أول 30 خبراً
               ========================================= */

            const finalNews =
                uniqueNews.slice(
                    0,
                    30
                );


            console.log(
                '📤 الأخبار المرسلة للوحة:',
                finalNews.length
            );


            console.log('');
            console.log(
                '======================================'
            );

            console.log(
                '📰 انتهى فحص الأخبار'
            );

            console.log(
                '======================================'
            );


            res.setHeader(
                'Cache-Control',
                'no-store, no-cache, must-revalidate'
            );


            res.setHeader(
                'Content-Type',
                'application/json; charset=utf-8'
            );


            res.json(
                finalNews
            );


        } catch (error) {

            console.error(
                '❌ خطأ عام في نظام الأخبار:',
                error.message
            );


            res.status(500).json({

                error:
                    'News unavailable'

            });

        }

    }
);


/* =====================================================
   الصفحة الرئيسية
   ===================================================== */

app.get(
    '/',
    (req, res) => {

        res.send(
            'Pricing Server is running'
        );

    }
);


/* =====================================================
   تشغيل السيرفر
   ===================================================== */

const PORT =
    process.env.PORT || 3000;


app.listen(
    PORT,
    () => {

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            'Bot is running...'
        );

        console.log(
            'News system is ready...'
        );

        console.log(
            'Push notification system is ready 🔔'
        );

    }
);
