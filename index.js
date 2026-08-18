const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.text({ type: '*/*' }));

const token = "8471621145:AAHKtyAoM4Jg_aYbUM_3yBSNpnjGpsRmWPQ";
const bot = new TelegramBot(token, { polling: true });

const SERVER_URL = "https://pricing-server-yjam.onrender.com/msg";

// استقبال رسائل القناة
bot.on('channel_post', async (msg) => {

    const lastMessage = msg.text || "";

    console.log("New message:", lastMessage);

    if (!lastMessage) return;

    try {

        const response = await fetch(SERVER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            },
            body: lastMessage
        });

        const result = await response.text();

        console.log("تم إرسال الرسالة إلى Render:", result);

    } catch (error) {

        console.error("خطأ أثناء إرسال الرسالة إلى Render:", error);

    }
});

// السيرفر المحلي يبقى شغال كما كان
app.get('/msg', (req, res) => {
    res.send("Bot is running");
});

app.listen(3000, () => {
    console.log("Local server running on http://localhost:3000");
});

console.log("Bot is running...");