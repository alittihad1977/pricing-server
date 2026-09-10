const { Pool } = require('pg');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('Price persistence: DATABASE_URL is missing');
} else {
    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 2
    });

    let ready = false;

    async function init() {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS price_state (
                    id INTEGER PRIMARY KEY,
                    message TEXT NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);
            ready = true;
            console.log('Price persistence: database ready');
        } catch (error) {
            console.error('Price persistence DB init error:', error.message);
        }
    }

    init();

    const originalTelegramOn = TelegramBot.prototype.on;
    TelegramBot.prototype.on = function(event, listener) {
        if (event === 'channel_post' && typeof listener === 'function') {
            const wrapped = async function(msg) {
                const message = String((msg && msg.text) || '');
                if (message && ready) {
                    try {
                        await pool.query(
                            `INSERT INTO price_state (id, message, updated_at)
                             VALUES (1, $1, NOW())
                             ON CONFLICT (id) DO UPDATE
                             SET message = EXCLUDED.message,
                                 updated_at = EXCLUDED.updated_at`,
                            [message]
                        );
                        console.log('Price persistence: latest price saved');
                    } catch (error) {
                        console.error('Price persistence save error:', error.message);
                    }
                }
                return listener.apply(this, arguments);
            };
            return originalTelegramOn.call(this, event, wrapped);
        }
        return originalTelegramOn.apply(this, arguments);
    };

    const originalExpressGet = express.application.get;
    express.application.get = function(path, ...handlers) {
        if (path === '/msg' && handlers.length > 0) {
            const originalHandler = handlers[handlers.length - 1];
            handlers[handlers.length - 1] = async function(req, res, next) {
                if (!ready) {
                    return originalHandler(req, res, next);
                }

                try {
                    const result = await pool.query(
                        'SELECT message FROM price_state WHERE id = 1 LIMIT 1'
                    );

                    if (result.rows.length > 0) {
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                        res.type('text/plain; charset=utf-8');
                        return res.send(result.rows[0].message);
                    }
                } catch (error) {
                    console.error('Price persistence read error:', error.message);
                }

                return originalHandler(req, res, next);
            };
        }

        return originalExpressGet.call(this, path, ...handlers);
    };
}
