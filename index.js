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

const parser = new Parser();


/* =====================================================
   آخر رسالة أسعار
   ===================================================== */

let lastMessage = '';


/* =====================================================
   مفاتيح VAPID
   ===================================================== */

/*
   تنظيف المفاتيح تلقائياً من:
   - المسافات
   - علامات الاقتباس
   - علامة = الموجودة في النهاية
*/

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
   إرسال إشعار
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
                'https://pricing-server-1.onrender.com'

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


            /*
               إذا كان الجهاز لم يعد مسجلاً،
               نحذفه من القائمة.
            */

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


        /*
           منع إرسال إشعار لنفس الرسالة
           أكثر من مرة.
        */

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


        /*
           إرسال الإشعار للموبايلات
        */

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
   الأخبار
   ===================================================== */

app.get(
    '/news',
    async (req, res) => {

        try {

            const feed =
                await parser.parseURL(
                    'https://feeds.bbci.co.uk/arabic/rss.xml'
                );


            const news =
                feed.items
                    .slice(0, 10)
                    .map(
                        item => ({

                            title:
                                item.title || '',

                            link:
                                item.link || '',

                            date:
                                item.pubDate || ''

                        })
                    );


            res.setHeader(
                'Cache-Control',
                'no-store'
            );


            res.json(
                news
            );


        } catch (error) {

            console.error(
                'News RSS Error:',
                error
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
