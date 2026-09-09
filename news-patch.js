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

const feeds = [
  { name: 'الشرق الأوسط - الرئيسية', url: 'https://aawsat.com/feed' },
  { name: 'الشرق الأوسط - العالم العربي', url: 'https://aawsat.com/feed/arab-world' },
  { name: 'الشرق الأوسط - الاقتصاد', url: 'https://aawsat.com/feed/economy' },
  { name: 'الشرق الأوسط - الرياضة', url: 'https://aawsat.com/feed/sport' },
  {
    name: 'سكاي نيوز عربية - الرياضة',
    url: 'https://www.skynewsarabia.com/rss.xml',
    sportsOnly: true
  },
  {
    name: 'الشرق القطرية - الرياضة',
    url: 'https://al-sharq.com/rss/latestNews',
    sportsOnly: true
  }
];

const sportsWords = /رياضة|رياضي|كرة القدم|كرة السلة|تنس|فورمولا|مباراة|دوري|كأس|بطولة|لاعب|لاعبة|مدرب|منتخب|نادي|فيفا|يويفا|sports?|football|basketball|tennis|formula|match|league|cup/i;

function isSports(item) {
  const categories = Array.isArray(item.categories) ? item.categories.join(' ') : '';
  const link = item.link || item.guid || '';
  const title = item.title || '';
  return sportsWords.test(categories) || /\/sport(?:\/|$)/i.test(link) || sportsWords.test(title);
}

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
  for (const feed of feeds) {
    try {
      const result = await parser.parseURL(feed.url);
      for (const item of (result.items || []).slice(0, 20)) {
        if (feed.sportsOnly && !isSports(item)) continue;
        const n = clean(item, feed.name);
        if (n.title) all.push(n);
      }
      console.log('✅ News source OK:', feed.name);
    } catch (error) {
      console.error('❌ News source failed:', feed.name, error.message);
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
    console.log('📰 News patch active: Asharq Al-Awsat + Sky News Arabia + Al-Sharq RSS');
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
