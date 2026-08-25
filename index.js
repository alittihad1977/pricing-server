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
   👥 عدد الموجودين الآن على لوحة التسعير
   ===================================================== */

const onlineUsers = new Map();

const ONLINE_TIMEOUT =
    60 * 1000;


/* =====================================================
   API عدد الموجودين الآن
   ===================================================== */

app.get(
    '/online',
    (req, res) => {

        res.setHeader(
            'Access-Control-Allow-Origin',
            '*'
        );

        res.setHeader(
            'Cache-Control',
            'no-store, no-cache, must-revalidate'
        );

        const userId =
            String(
                req.query.id || ''
            ).trim();


        if (!userId) {

            return res.status(400).json({

                success:
                    false,

                error:
                    'User ID is required'

            });

        }


        onlineUsers.set(
            userId,
            Date.now()
        );


        const now =
            Date.now();


        for (
            const [id, lastSeen]
            of onlineUsers.entries()
        ) {

            if (
                now -
                lastSeen >
                ONLINE_TIMEOUT
            ) {

                onlineUsers.delete(
                    id
                );

            }

        }


        res.json({

            success:
                true,

            online:
                onlineUsers.size

        });

    }
);


/* =====================================================
   تنظيف الأجهزة القديمة
   ===================================================== */

setInterval(
    () => {

        const now =
            Date.now();


        for (
            const [id, lastSeen]
            of onlineUsers.entries()
        ) {

            if (
                now -
                lastSeen >
                ONLINE_TIMEOUT
            ) {

                onlineUsers.delete(
                    id
                );

            }

        }

    },
    30 * 1000
);


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
   MET Norway Locationforecast 2.0
   ===================================================== */

let weatherCache = null;

let weatherCacheTime = 0;

const WEATHER_CACHE_TIME =
    10 * 60 * 1000;


/* =====================================================
   تحويل symbol_code من MET Norway
   ===================================================== */

function getWeatherInfo(
    symbolCode
) {

    const code =
        String(symbolCode || '')
            .toLowerCase();


    if (
        code.includes('clearsky_day')
    ) {

        return {
            icon: '☀️',
            description: 'صافٍ'
        };

    }


    if (
        code.includes('clearsky_night')
    ) {

        return {
            icon: '🌙',
            description: 'سماء صافية'
        };

    }


    if (
        code.includes('fair_day')
    ) {

        return {
            icon: '🌤️',
            description: 'صحو جزئياً'
        };

    }


    if (
        code.includes('fair_night')
    ) {

        return {
            icon: '🌙',
            description: 'صحو'
        };

    }


    if (
        code.includes('partlycloudy_day')
    ) {

        return {
            icon: '🌤️',
            description: 'غائم جزئياً'
        };

    }


    if (
        code.includes('partlycloudy_night')
    ) {

        return {
            icon: '☁️',
            description: 'غائم جزئياً'
        };

    }


    if (
        code.includes('cloudy')
    ) {

        return {
            icon: '☁️',
            description: 'غائم'
        };

    }


    if (
        code.includes('fog')
    ) {

        return {
            icon: '🌫️',
            description: 'ضباب'
        };

    }


    if (
        code.includes('lightrain')
    ) {

        return {
            icon: '🌦️',
            description: 'مطر خفيف'
        };

    }


    if (
        code.includes('heavyrain')
    ) {

        return {
            icon: '🌧️',
            description: 'مطر غزير'
        };

    }


    if (
        code.includes('rain')
    ) {

        return {
            icon: '🌧️',
            description: 'مطر'
        };

    }


    if (
        code.includes('lightsleet')
    ) {

        return {
            icon: '🌧️',
            description: 'مطر متجمد خفيف'
        };

    }


    if (
        code.includes('heavysleet')
    ) {

        return {
            icon: '🌨️',
            description: 'مطر متجمد غزير'
        };

    }


    if (
        code.includes('sleet')
    ) {

        return {
            icon: '🌧️',
            description: 'مطر متجمد'
        };

    }


    if (
        code.includes('lightsnow')
    ) {

        return {
            icon: '🌨️',
            description: 'ثلوج خفيفة'
        };

    }


    if (
        code.includes('heavysnow')
    ) {

        return {
            icon: '❄️',
            description: 'ثلوج غزيرة'
        };

    }


    if (
        code.includes('snow')
    ) {

        return {
            icon: '❄️',
            description: 'ثلوج'
        };

    }


    if (
        code.includes('thunder')
    ) {

        return {
            icon: '⛈️',
            description: 'عاصفة رعدية'
        };

    }


    return {

        icon:
            '🌤️',

        description:
            'غير محدد'

    };

}


/* =====================================================
   جلب طقس حلب من MET Norway
   ===================================================== */

async function fetchAleppoWeather() {

    const url =
        'https://api.met.no/weatherapi/locationforecast/2.0/compact' +
        '?lat=36.2021' +
        '&lon=37.1343';


    console.log(
        '🌤️ جاري جلب طقس حلب من MET Norway...'
    );


    try {

        const response =
            await fetch(
                url,
                {
                    headers: {

                        'User-Agent':
                            'Al-Ittihad-Pricing-Server/1.0 contact: admin@pricing-server.com',

                        'Accept':
                            'application/json'

                    }

                }
            );


        const text =
            await response.text();


        if (
            !response.ok
        ) {

            throw new Error(
                'MET Norway HTTP ' +
                response.status +
                ' - ' +
                text.substring(0, 500)
            );

        }


        const data =
            JSON.parse(
                text
            );


        if (
            !data ||
            !data.properties ||
            !data.properties.timeseries ||
            !data.properties.timeseries.length
        ) {

            throw new Error(
                'MET Norway weather data missing'
            );

        }


        const current =
            data.properties.timeseries[0];


        if (
            !current ||
            !current.data ||
            !current.data.instant ||
            !current.data.instant.details
        ) {

            throw new Error(
                'MET Norway current data missing'
            );

        }


        const details =
            current.data.instant.details;


        const temperature =
            Math.round(
                Number(
                    details.air_temperature
                )
            );


        const symbolCode =
            (
                current.data.next_1_hours &&
                current.data.next_1_hours.summary &&
                current.data.next_1_hours.summary.symbol_code
            ) ||
            (
                current.data.next_6_hours &&
                current.data.next_6_hours.summary &&
                current.data.next_6_hours.summary.symbol_code
            ) ||
            'clearsky_day';


        const weatherInfo =
            getWeatherInfo(
                symbolCode
            );


        const timeString =
            current.time ||
            '';


        const isDay =
            !symbolCode.includes(
                '_night'
            );


        return {

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
                timeString,

            source:
                'MET Norway'

        };

    } catch (error) {

        console.error(
            '❌ MET Norway Weather Error:',
            error.message
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
   🧪 اختبار BiQuote
   ===================================================== */

app.get(
    '/test-markets',
    async (req, res) => {

        try {

            const url =
                'https://biquote.io/api/XAUUSD';


            console.log(
                '🥇 اختبار BiQuote للذهب...'
            );

            console.log(
                '🌐 URL:',
                url
            );


            const response =
                await fetch(
                    url,
                    {
                        headers: {
                            'Accept':
                                'application/json'
                        }
                    }
                );


            const text =
                await response.text();


            console.log(
                '📊 BiQuote Status:',
                response.status
            );

            console.log(
                '📊 BiQuote Response:',
                text
            );


            res.setHeader(
                'Access-Control-Allow-Origin',
                '*'
            );

            res.setHeader(
                'Cache-Control',
                'no-store'
            );

            res.setHeader(
                'Content-Type',
                'application/json; charset=utf-8'
            );


            res.status(
                response.status
            );


            try {

                res.json(
                    JSON.parse(text)
                );

            } catch {

                res.send(
                    text
                );

            }

        } catch (error) {

            console.error(
                '❌ BiQuote Error:',
                error.message
            );


            res.status(500).json({

                success:
                    false,

                error:
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

            try {

                const result =
                    await parser.parseURL(
                        feed.url
                    );


                const items =
                    result.items || [];


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
                    feed.name,
                    error.message
                );

            }

        }


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
            'Weather source: MET Norway 🌍'
        );

        console.log(
            'Push notification system is ready 🔔'
        );

        console.log(
            'Online users system is ready 👥'
        );

        console.log(
            'BiQuote test endpoint is ready 📈'
        );

    }
);
