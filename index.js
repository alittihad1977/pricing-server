const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');

const app = express();

// السماح للوحة التسعير بالوصول إلى السيرفر
app.use(cors());

// استقبال النصوص
app.use(express.text({ type: '*/*' }));

// ===============================
// إعدادات البوت
// ===============================

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error("8471621145:AAHKtyAoM4Jg_aYbUM_3yBSNpnjGpsRmWPQ");
    process.exit(1);
}

const bot = new TelegramBot(token, {
    polling: true
});

// ===============================
// تخزين آخر رسالة
// ===============================

let lastMessage = "";

// ===============================
// استقبال رسائل قناة Telegram
// ===============================

bot.on('channel_post', async (msg) => {

    const message = msg.text || "";

    console.log("تم استقبال رسالة جديدة:");
    console.log(message);

    if (!message) return;

    // حفظ آخر رسالة مباشرة
    lastMessage = message;

    console.log("تم حفظ الرسالة بنجاح");
});

// ===============================
// إرسال آخر رسالة للوحة التسعير
// ===============================

app.get('/msg', (req, res) => {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    res.send(lastMessage);
});

// ===============================
// فحص السيرفر
// ===============================

app.get('/', (req, res) => {
    res.send("Pricing Server is running");
});

// ===============================
// تشغيل السيرفر
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);
    console.log("Bot is running...");
});
