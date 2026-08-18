const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

let latestMessage = "";

app.use(express.text({ type: "*/*" }));

// استقبال رسالة الأسعار
app.post("/msg", (req, res) => {
    latestMessage = req.body || "";
    console.log("تم استقبال رسالة جديدة");
    res.send("OK");
});

// إعطاء آخر رسالة للوحة التسعير
app.get("/msg", (req, res) => {
    res.type("text/plain").send(latestMessage);
});

// صفحة اختبار
app.get("/", (req, res) => {
    res.send("Pricing Server is Running");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
