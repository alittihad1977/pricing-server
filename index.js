const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const webpush = require('web-push');

const app = express();

app.use(cors());

app.use(express.json());

app.use(express.text({ type: 'text/*' }));


/* =====================================================
   إعداد Telegram
   ===================================================== */

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {

    console.error(
        'TELEGRAM_BOT_TOKEN is missing'
    );

    process.exit(1);

}

const bot = new TelegramBot(
    token,
    {
        polling: true
    }
);


/* =====================================================
   الأخبار
   ===================================================== */

const parser = new Parser();


/* =====================================================
   نظام Push Notifications
   ===================================================== */

const vapidPublicKey =
    process.env.VAPID_PUBLIC_KEY;

const vapidPrivateKey =
    process.env.VAPID_PRIVATE_KEY;


/*
   نحافظ على عمل السيرفر حتى لو
   مفاتيح الإشعارات غير موجودة
*/

if (
    vapidPublicKey &&
    vapidPrivateKey
) {

    webpush.setVapidDetails(

        'https://pricing-server-1.onrender.com',

        vapidPublicKey,

        vapidPrivateKey

    );

    console.log(
        'Push notification system is ready...'
    );

} else {

    console.log(
        'Push notification keys are missing'
    );

}


/*
   قائمة الأجهزة المشتركة
*/

let pushSubscriptions = [];


/* =====================================================
   الأسعار
   ===================================================== */

let lastMessage = '';

let lastPrices = null;


/* =====================================================
   استخراج أسعار الشراء والمبيع
   ===================================================== */

function extractPrices(text) {

    const buys = [

        ...text.matchAll(
            /الشراء\s*[:：]\s*([0-9]+(?:\.[0-9]+)?)/g
        )

    ].map(
        match => match[1]
    );


    const sells = [

        ...text.matchAll(
            /المبيع\s*[:：]\s*([0-9]+(?:\.[0-9]+)?)/g
        )

    ].map(
        match => match[1]
    );


    return {

        buys: buys.slice(0, 5),

        sells: sells.slice(0, 5)

    };

}


/* =====================================================
   التأكد من وجود تغيير فعلي
   ===================================================== */

function pricesChanged(
    oldPrices,
    newPrices
) {

    if (!oldPrices) {

        return false;

    }


    return (
        JSON.stringify(oldPrices) !==
        JSON.stringify(newPrices)
    );

}


/* =====================================================
   تحديد الأسعار التي تغيرت
   ===================================================== */

function getChangedPrices(
    oldPrices,
    newPrices
) {

    const changed = [];


    if (!oldPrices) {

        return changed;

    }


    for (
        let i = 0;
        i < 5;
        i++
    ) {

        const oldBuy =
            oldPrices.buys[i];

        const newBuy =
            newPrices.buys[i];


        const oldSell =
            oldPrices.sells[i];

        const newSell =
            newPrices.sells[i];


        if (
            oldBuy !== undefined &&
            newBuy !== undefined &&
            oldBuy !== newBuy
        ) {

            changed.push(
                `شراء ${newBuy}`
            );

        }


        if (
            oldSell !== undefined &&
            newSell !== undefined &&
            oldSell !== newSell
        ) {

            changed.push(
                `بيع ${newSell}`
            );

        }

    }


    return changed;

}


/* =====================================================
   إرسال Push Notification
   ===================================================== */

async function sendPriceNotification(
    changedPrices
) {

    if (
        !vapidPublicKey ||
        !vapidPrivateKey
    ) {

        console.log(
            'Push keys are not configured'
        );

        return;

    }


    if (
        pushSubscriptions.length === 0
    ) {

        console.log(
            'No devices subscribed'
        );

        return;

    }


    let message =
        'تم تحديث أسعار العملات 💰';


    if (
        changedPrices.length > 0
    ) {

        message +=
            '\n' +
            changedPrices.join(' • ');

    }


    const payload =
        JSON.stringify({

            title:
                'شركة الاتحاد 🔔',

            body:
                message,

            url:
                'https://alittihad1977.github.io/pricing-server/asd.html'

        });


    const subscriptionsToRemove = [];


    for (
        const subscription of pushSubscriptions
    ) {

        try {

            await webpush.sendNotification(
                subscription,
                payload
            );


            console.log(
                'تم إرسال إشعار للموبايل'
            );


        } catch (error) {

            console.error(
                'Push notification error:',
                error.statusCode
            );


            /*
               إذا الجهاز لم يعد مشتركاً
               نحذفه من القائمة
            */

            if (
                error.statusCode === 404 ||
                error.statusCode === 410
            ) {

                subscriptionsToRemove.push(
                    subscription
                );

            }

        }

    }


    if (
        subscriptionsToRemove.length > 0
    ) {

        pushSubscriptions =
            pushSubscriptions.filter(
                sub =>
                    !subscriptionsToRemove.includes(
                        sub
                    )
            );

    }

}


/* =====================================================
   استقبال رسائل Telegram
   ===================================================== */

bot.on(
    'channel_post',
    (msg) => {

        const message =
            msg.text || '';


        if (!message) {

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
           استخراج الأسعار الجديدة
        */

        const newPrices =
            extractPrices(
                message
            );


        /*
           التأكد من وجود أسعار
        */

        const hasPrices =
            newPrices.buys.length > 0 ||
            newPrices.sells.length > 0;


        if (!hasPrices) {

            return;

        }


        /*
           إذا تغير السعر فعلياً
        */

        if (
            pricesChanged(
                lastPrices,
                newPrices
            )
        ) {

            const changedPrices =
                getChangedPrices(
                    lastPrices,
                    newPrices
                );


            console.log(
                'تم اكتشاف تغيير في الأسعار'
            );


            /*
               إرسال الإشعار
            */

            sendPriceNotification(
                changedPrices
            );

        }


        /*
           حفظ الأسعار الحالية
        */

        lastPrices =
            newPrices;

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
            'no-store'
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
   مفتاح Push العام
   ===================================================== */

app.get(
    '/vapidPublicKey',
    (req, res) => {

        res.setHeader(
            'Access-Control-Allow-Origin',
            '*'
        );


        res.json({

            publicKey:
                vapidPublicKey || ''

        });

    }
);


/* =====================================================
   تسجيل جهاز جديد للإشعارات
   ===================================================== */

app.post(
    '/subscribe',
    (req, res) => {

        const subscription =
            req.body;


        if (
            !subscription ||
            !subscription.endpoint
        ) {

            return res
                .status(400)
                .json({

                    error:
                        'Invalid subscription'

                });

        }


        /*
           منع تكرار نفس الجهاز
        */

        const exists =
            pushSubscriptions.some(
                sub =>
                    sub.endpoint ===
                    subscription.endpoint
            );


        if (!exists) {

            pushSubscriptions.push(
                subscription
            );


            console.log(
                'تم تسجيل جهاز جديد للإشعارات'
            );

        }


        res.json({

            success: true

        });

    }
);


/* =====================================================
   اختبار الإشعارات
   ===================================================== */

app.post(
    '/test-notification',
    async (req, res) => {

        try {

            await sendPriceNotification(
                [
                    'اختبار الإشعار'
                ]
            );


            res.json({

                success: true

            });


        } catch (error) {

            console.error(
                error
            );


            res
                .status(500)
                .json({

                    success: false

                });

        }

    }
);


/* =====================================================
   نظام الأخبار
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


            res
                .status(500)
                .json({

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
            'Push notification system is ready...'
        );

    }
);
