/* News source patch - loaded before index.js via NODE_OPTIONS */
const Parser = require('rss-parser');
const express = require('express');

const parser = new Parser({
  timeout: 12000,
  headers: {
    'User-Agent': 'Al-Ittihad-Pricing-Server/1.0',
    'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
  }
});

// Keep all news sources on the same verified RSS provider for maximum stability.
const feeds = [
  { name: 'الشرق الأوسط - الرئيسية', url: 'https://aawsat.com/feed' },
  { name: 'الشرق الأوسط - كل الأخبار', url: 'https://aawsat.com/feed/news' },
  { name: 'الشرق الأوسط - العالم العربي', url: 'https://aawsat.com/feed/arab-world' },
  { name: 'الشرق الأوسط - الخليج', url: 'https://aawsat.com/feed/gulf' },
  { name: 'الشرق الأوسط - أوروبا', url: 'https://aawsat.com/feed/europe' },
  { name: 'الشرق الأوسط - الأميركيتين', url: 'https://aawsat.com/feed/america' },
  { name: 'الشرق الأوسط - آسيا', url: 'https://aawsat.com/feed/asia' },
  { name: 'الشرق الأوسط - أفريقيا', url: 'https://aawsat.com/feed/africa' },
  { name: 'الشرق الأوسط - الاقتصاد', url: 'https://aawsat.com/feed/economy' },
  { name: 'الشرق الأوسط - الرياضة', url: 'https://aawsat.com/feed/sport' },
  { name: 'الشرق الأوسط - التقنية', url: 'https://aawsat.com/feed/information-technology' },
  { name: 'الشرق الأوسط - العلوم', url: 'https://aawsat.com/feed/science' },
  { name: 'الشرق الأوسط - الثقافة', url: 'https://aawsat.com/feed/culture' }
];

function clean(item, source) {
  return {
    title: item.title || '',
    link: item.link || item.guid || '',
    date: item.pubDate || item.isoDate || '',
    source
  };
}

async function loadNews() {
  const all = [];

  // One failed feed must never stop the other feeds from working.
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const result = await parser.parseURL(feed.url);
      return { feed, items: result.items || [] };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { feed, items } = result.value;
      for (const item of items.slice(0, 12)) {
        const n = clean(item, feed.name);
        if (n.title) all.push(n);
      }
      console.log('✅ News source OK:', feed.name);
    } else {
      const message = result.reason && result.reason.message ? result.reason.message : String(result.reason);
      console.error('❌ News source failed:', message);
    }
  }

  const unique = all.filter((item, index, arr) =>
    index === arr.findIndex(other => other.title === item.title)
  );

  unique.sort((a, b) =>
    new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );

  return unique.slice(0, 30);
}

const originalGet = express.application.get;
express.application.get = function(path, ...handlers) {
  if (path === '/news') {
    console.log('📰 News patch active: Expanded Asharq Al-Awsat RSS');
    return originalGet.call(this, path, async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      try {
        const news = await loadNews();
        res.json(news);
      } catch (error) {
        console.error('❌ News API error:', error.message);
        res.status(503).json([]);
      }
    });
  }
  return originalGet.call(this, path, ...handlers);
};

console.log('📰 News patch loaded');
