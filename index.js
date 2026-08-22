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
   🌤️ نظام الطقس
   ===================================================== */

let weatherCache = null;

let weatherCacheTime = 0;

const WEATHER_CACHE_TIME =
    10 * 60 * 1000;


/* =====================================================
   تحويل حالة الطقس إلى وصف وأيقونة
   ===================================================== */

function getWeatherInfo(
    weatherCode,
    isDay
) {

    const code =
        Number(weatherCode);


    if (code === 0) {

        return {

            icon:
                isDay ? '☀️' : '🌙',

            description:
                isDay ? 'صافٍ' : 'سماء صافية'

        };

    }


    if (
        code === 1 ||
        code === 2
    ) {

        return {

            icon:
                isDay ? '🌤️' : '☁️',

            description:
                'غائم جزئياً'

        };

    }


    if (code === 3) {

        return {

            icon:
                '☁️',

            description:
                'غائم'

        };

    }


    if (
        code === 45 ||
        code === 48
    ) {

        return {

            icon:
                '🌫️',

            description:
                'ضباب'

        };

    }


    if (
        code === 51 ||
        code === 53 ||
        code === 55
    ) {

        return {

            icon:
                '🌦️',

            description:
                'رذاذ'

        };

    }


    if (
        code === 56 ||
        code === 57
    ) {

        return {

            icon:
                '🌧️',

            description:
                'رذاذ متجمد'

        };

    }


    if (
        code === 61 ||
        code === 63 ||
        code === 65
    ) {

        return {

            icon:
                '🌧️',

            description:
                'مطر'

        };

    }


    if (
        code === 66 ||
        code === 67
    ) {

        return {

            icon:
                '🌧️',

            description:
                'مطر متجمد'

        };

    }


    if (
        code === 71 ||
        code === 73 ||
        code === 75 ||
        code === 77
    ) {

        return {

            icon:
                '❄️',

            description:
                'ثلوج'

        };

    }


    if (
        code === 80 ||
        code === 81 ||
        code === 82
    ) {

        return {

            icon:
                '🌦️',

            description:
                'زخات مطر'

        };

    }


    if (
        code === 85 ||
        code === 86
    ) {

        return {

            icon:
                '🌨️',

            description:
                'زخات ثلج'

        };

    }


    if (
        code === 95
    ) {

        return {

            icon:
                '⛈️',

            description:
                'عاصفة رعدية'

        };

    }


    if (
        code === 96 ||
        code === 99
    ) {

        return {

            icon:
                '⛈️',

            description:
                'عاصفة رعدية وبَرَد'

        };

    }


    return {

        icon:
            isDay ? '🌤️' : '🌙',

        description:
            'غير محدد'

    };

}


/* =====================================================
   جلب طقس حلب
   ===================================================== */

async function fetchAleppoWeather() {

    const url =
        'https://api.open-meteo.com/v1/forecast' +
        '?latitude=36.2021' +
        '&longitude=37.1343' +
        '&current=temperature_2m,is_day,weather_code' +
        '&timezone=Asia%2FDamascus';


    console.log(
        '🌤️ جاري جلب طقس حلب...'
    );

    console.log(
        '🌐 Weather URL:',
        url
    );


    try {

        const response =
            await fetch(
                url
            );


        console.log(
            '🌤️ Weather HTTP Status:',
            response.status
        );


        const text =
            await response.text();


        console.log(
            '🌤️ Weather Response:',
            text
        );


        if (
            !response.ok
        ) {

            throw new Error(
                'Weather API HTTP ' +
                response.status +
                ' - ' +
                text
            );

        }


        const data =
            JSON.parse(
                text
            );


        if (
            !data ||
            !data.current
        ) {

            throw new Error(
                'Weather data missing: ' +
                JSON.stringify(data)
            );

        }


        const temperature =
            Math.round(
                Number(
                    data.current.temperature_2m
                )
            );


        const isDay =
            Number(
                data.current.is_day
            ) === 1;


        const weatherCode =
            Number(
                data.current.weather_code
            );


        const weatherInfo =
            getWeatherInfo(
                weatherCode,
                isDay
            );


        const result = {

            city:
                'حلب',

            temperature:
                temperature,

            icon:
                weatherInfo.icon,

            description:
                weatherInfo.description,

            isDay:
                isDay,

            updated:
                data.current.time || ''

        };


        console.log(
            '🌤️ طقس حلب:',
            temperature + '°',
            weatherInfo.icon,
            weatherInfo.description
        );


        return result;

    } catch (error) {

        console.error(
            '❌❌❌ WEATHER FETCH ERROR ❌❌❌'
        );

        console.error(
            'Name:',
            error.name
        );

        console.error(
            'Message:',
            error.message
        );

        console.error(
            'Stack:',
            error.stack
        );


        throw error;

    }

}


/* =====================================================
   API الطقس
   ===================================================== */

app.get(
    '/weather',
    async (req, res) => {

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


        try {

            const now =
                Date.now();


            if (
                weatherCache &&
                (
                    now -
                    weatherCacheTime
                ) <
                WEATHER_CACHE_TIME
            ) {

                console.log(
                    '🌤️ استخدام بيانات الطقس المخزنة'
                );


                return res.json(
                    weatherCache
                );

            }


            const weather =
                await fetchAleppoWeather();


            weatherCache =
                weather;


            weatherCacheTime =
                now;


            res.json(
                weather
            );


        } catch (error) {

            console.error(
                '❌ Weather Error:',
                error.message
            );


            if (
                weatherCache
            ) {

                return res.json(
                    weatherCache
                );

            }


            res.status(503).json({

                error:
                    'Weather unavailable',

                details:
                    error.message

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

        console.log('');
        console.log(
            '======================================'
        );
        console.log(
            '📰 بدء فحص جميع مصادر الأخبار'
        );
        console.log(
            '======================================'
        );


        const feeds = [

            {
                name:
                    'BBC Arabic',

                url:
                    'https://feeds.bbci.co.uk/arabic/rss.xml'
            },

            {
                name:
                    'العربية - أسواق',

                url:
                    'https://www.alarabiya.net/feed/rss2/ar/aswaq.xml'
            },

            {
                name:
                    'العربية - رياضة',

                url:
                    'https://www.alarabiya.net/feed/rss2/ar/sport.xml'
            },

            {
                name:
                    'العربية - العرب والعالم',

                url:
                    'https://www.alarabiya.net/feed/rss2/ar/arab-and-world.xml'
            }

        ];


        const allNews = [];


        for (
            const feed
            of feeds
        ) {

            console.log('');
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


                const sourceNews =
                    items
                        .slice(0, 10)
                        .map(
                            item => ({

                                title:
                                    item.title || '',

                                link:
                                    item.link || '',

                                date:
                                    item.pubDate || '',

                                source:
                                    feed.name

                            })
                        );


                allNews.push(
                    ...sourceNews
                );


            } catch (error) {

                console.error(
                    '❌ فشل المصدر:',
                    feed.name
                );

                console.error(
                    'الخطأ:',
                    error.message
                );

            }

        }


        console.log('');
        console.log(
            '📊 مجموع الأخبار قبل إزالة التكرار:',
            allNews.length
        );


        const uniqueNews =
            allNews.filter(
                (item, index, self) =>
                    index ===
                    self.findIndex(
                        other =>
                            other.title ===
                            item.title
                    )
            );


        console.log(
            '📊 مجموع الأخبار بعد إزالة التكرار:',
            uniqueNews.length
        );


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


        const finalNews =
            uniqueNews.slice(
                0,
                30
            );


        console.log(
            '📤 الأخبار المرسلة للوحة:',
            finalNews.length
        );


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


        res.json(
            finalNews
        );

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
            'Weather system is ready 🌤️'
        );

        console.log(
            'Push notification system is ready 🔔'
        );

    }
);
