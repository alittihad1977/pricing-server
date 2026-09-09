const express = require('express');

const REPO = process.env.COMPANY_NEWS_REPO || 'alittihad1977/pricing-server';
const FILE_PATH = process.env.COMPANY_NEWS_FILE || 'company-news.json';
const ADMIN_PASSWORD = process.env.NEWS_ADMIN_PASSWORD || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

const API_BASE = 'https://api.github.com';

async function githubRequest(method, path, body) {
    if (!GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN is missing');
    }

    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Al-Ittihad-Company-News'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) {}

    if (!response.ok) {
        throw new Error(data.message || `GitHub HTTP ${response.status}`);
    }

    return data;
}

async function readNewsFile() {
    const data = await githubRequest(
        'GET',
        `/repos/${REPO}/contents/${FILE_PATH}?ref=main`
    );

    const decoded = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
    let parsed;
    try { parsed = JSON.parse(decoded); } catch (_) { parsed = { version: 1, items: [] }; }

    if (!parsed || !Array.isArray(parsed.items)) parsed = { version: 1, items: [] };
    return { data, parsed };
}

async function writeNewsFile(parsed, sha) {
    const content = Buffer.from(
        JSON.stringify({ version: 1, items: parsed.items }, null, 2) + '\n',
        'utf8'
    ).toString('base64');

    return githubRequest(
        'PUT',
        `/repos/${REPO}/contents/${FILE_PATH}`,
        {
            message: 'Update company news',
            content,
            sha,
            branch: 'main'
        }
    );
}

function cleanText(value, max) {
    return String(value || '').trim().slice(0, max);
}

function normalizeDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function publicItems(parsed) {
    const now = Date.now();
    return parsed.items
        .filter(item => {
            if (!item || item.enabled === false) return false;
            const start = item.startAt ? new Date(item.startAt).getTime() : -Infinity;
            const end = item.endAt ? new Date(item.endAt).getTime() : Infinity;
            return Number.isFinite(start) ? start <= now && now < end : now < end;
        })
        .sort((a, b) => {
            const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : 9999;
            const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : 9999;
            if (orderA !== orderB) return orderA - orderB;
            return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        });
}

function adminItems(parsed) {
    return [...parsed.items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function checkPassword(req) {
    return !!ADMIN_PASSWORD && String(req.body && req.body.password || '') === ADMIN_PASSWORD;
}

const originalListen = express.application.listen;

express.application.listen = function(...args) {
    const app = this;

    // Public company-news feed used by the pricing board.
    app.get('/company-news', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        try {
            const { parsed } = await readNewsFile();
            res.json(publicItems(parsed));
        } catch (error) {
            console.error('Company news GET error:', error.message);
            res.status(503).json({ success: false, error: 'Company news unavailable' });
        }
    });

    // Admin list. Password is required in the POST body.
    app.post('/company-news/admin-list', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (!checkPassword(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
        try {
            const { parsed } = await readNewsFile();
            res.json({ success: true, items: adminItems(parsed) });
        } catch (error) {
            console.error('Company news admin-list error:', error.message);
            res.status(503).json({ success: false, error: error.message });
        }
    });

    app.post('/company-news/create', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (!checkPassword(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
        const title = cleanText(req.body.title, 180);
        const body = cleanText(req.body.body, 600);
        if (!title) return res.status(400).json({ success: false, error: 'Title is required' });

        try {
            const { data, parsed } = await readNewsFile();
            const now = new Date().toISOString();
            const item = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                title,
                body,
                enabled: req.body.enabled !== false,
                order: Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 999,
                startAt: normalizeDate(req.body.startAt),
                endAt: normalizeDate(req.body.endAt),
                createdAt: now,
                updatedAt: now
            };
            parsed.items.push(item);
            await writeNewsFile(parsed, data.sha);
            res.json({ success: true, item });
        } catch (error) {
            console.error('Company news create error:', error.message);
            res.status(503).json({ success: false, error: error.message });
        }
    });

    app.post('/company-news/update', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (!checkPassword(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
        const id = cleanText(req.body.id, 100);
        const title = cleanText(req.body.title, 180);
        const body = cleanText(req.body.body, 600);
        if (!id || !title) return res.status(400).json({ success: false, error: 'ID and title are required' });

        try {
            const { data, parsed } = await readNewsFile();
            const item = parsed.items.find(x => x.id === id);
            if (!item) return res.status(404).json({ success: false, error: 'News item not found' });
            item.title = title;
            item.body = body;
            item.enabled = req.body.enabled !== false;
            item.order = Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 999;
            item.startAt = normalizeDate(req.body.startAt);
            item.endAt = normalizeDate(req.body.endAt);
            item.updatedAt = new Date().toISOString();
            await writeNewsFile(parsed, data.sha);
            res.json({ success: true, item });
        } catch (error) {
            console.error('Company news update error:', error.message);
            res.status(503).json({ success: false, error: error.message });
        }
    });

    app.post('/company-news/delete', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (!checkPassword(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
        const id = cleanText(req.body.id, 100);
        if (!id) return res.status(400).json({ success: false, error: 'ID is required' });

        try {
            const { data, parsed } = await readNewsFile();
            const before = parsed.items.length;
            parsed.items = parsed.items.filter(x => x.id !== id);
            if (parsed.items.length === before) return res.status(404).json({ success: false, error: 'News item not found' });
            await writeNewsFile(parsed, data.sha);
            res.json({ success: true });
        } catch (error) {
            console.error('Company news delete error:', error.message);
            res.status(503).json({ success: false, error: error.message });
        }
    });

    return originalListen.apply(app, args);
};

require('./index.js');
