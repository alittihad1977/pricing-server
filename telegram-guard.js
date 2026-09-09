/* Prevent duplicate Telegram polling on secondary Render services.
   Enable with DISABLE_TELEGRAM_BOT=true and NODE_OPTIONS=--require ./telegram-guard.js --require ./news-patch.js
*/
const Module = require('module');
const originalLoad = Module._load;

if (process.env.DISABLE_TELEGRAM_BOT === 'true') {
  Module._load = function(request, parent, isMain) {
    if (request === 'node-telegram-bot-api') {
      return class DisabledTelegramBot {
        constructor() {}
        on() { return this; }
        stopPolling() { return Promise.resolve(); }
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  console.log('🤖 Telegram polling disabled on this secondary service');
}
