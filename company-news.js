/* =====================================================
   📢 أخبار شركة الاتحاد
   هذا الملف يندمج مع شريط الأخبار الحالي ولا يلمس الأسعار والأسواق.
===================================================== */

(function(){
    'use strict';

    const COMPANY_NEWS_DISPLAY_TIME = 15000;
    const COMPANY_NEWS_REFRESH_TIME = 10000;

    let companyNewsList = [];
    let combinedNewsList = [];
    let companyNewsIndex = 0;
    let companyNewsTimer = null;
    let lastCompanyNewsSignature = '';

    function getCompanyNewsEndpoint(){
        return (typeof SERVER !== 'undefined' ? SERVER : '') + '/company-news';
    }

    function getCombinedNews(){
        const general = Array.isArray(newsList) ? newsList : [];
        const company = companyNewsList.map(function(item){
            return {
                title: item.title || '',
                body: item.body || '',
                isCompany: true,
                id: item.id || ''
            };
        });

        return company.concat(general);
    }

    function setCompanyMode(isCompany){
        const bar = document.querySelector('.bottom-bar');
        const title = document.getElementById('bottomTitle');

        if(bar){
            bar.classList.toggle('company-news-active', !!isCompany);
        }

        if(title){
            title.textContent = isCompany
                ? '📢 أخبار شركة الاتحاد'
                : '📰 آخر الأخبار';
        }
    }

    function clearCompanyTimer(){
        if(companyNewsTimer){
            clearTimeout(companyNewsTimer);
            companyNewsTimer = null;
        }
    }

    function renderCombinedNews(){
        if(typeof bottomMode === 'undefined' || bottomMode !== 'news') return;

        clearCompanyTimer();
        combinedNewsList = getCombinedNews();

        if(!combinedNewsList.length){
            setCompanyMode(false);
            showNewsMessage('لا توجد أخبار حالياً');
            return;
        }

        if(companyNewsIndex >= combinedNewsList.length){
            companyNewsIndex = 0;
        }

        const track = document.getElementById('newsTrack');
        if(!track) return;

        track.innerHTML = '';

        const itemData = combinedNewsList[companyNewsIndex];
        const item = document.createElement('div');
        item.className = itemData.isCompany
            ? 'news-item active company-news-item'
            : 'news-item active';

        const text = itemData.isCompany && itemData.body
            ? itemData.title + ' — ' + itemData.body
            : itemData.title;

        item.textContent = text;

        const separator = document.createElement('span');
        separator.className = itemData.isCompany
            ? 'news-separator company-news-separator'
            : 'news-separator';
        separator.textContent = '◆';
        item.appendChild(separator);

        track.appendChild(item);
        setCompanyMode(!!itemData.isCompany);

        companyNewsTimer = setTimeout(function(){
            if(typeof bottomMode === 'undefined' || bottomMode !== 'news') return;

            item.classList.remove('active');

            setTimeout(function(){
                if(typeof bottomMode === 'undefined' || bottomMode !== 'news') return;

                companyNewsIndex++;
                if(companyNewsIndex >= combinedNewsList.length){
                    companyNewsIndex = 0;
                    setCompanyMode(false);
                    if(typeof showMarketsMode === 'function'){
                        showMarketsMode();
                    }
                    return;
                }

                renderCombinedNews();
            }, 800);
        }, itemData.isCompany ? COMPANY_NEWS_DISPLAY_TIME : 7000);
    }

    // Replace only the news rotation. Markets continue using the existing function.
    window.startNews = function(){
        if(typeof marketTimer !== 'undefined' && marketTimer){
            clearTimeout(marketTimer);
            marketTimer = null;
        }

        if(typeof newsTimer !== 'undefined' && newsTimer){
            clearTimeout(newsTimer);
            newsTimer = null;
        }

        bottomMode = 'news';
        companyNewsIndex = 0;

        const newsTrack = document.getElementById('newsTrack');
        const marketsTrack = document.getElementById('marketsTrack');

        if(newsTrack){
            newsTrack.style.opacity = '1';
            newsTrack.style.pointerEvents = 'auto';
        }

        if(marketsTrack){
            marketsTrack.style.opacity = '0';
            marketsTrack.style.pointerEvents = 'none';
        }

        renderCombinedNews();
    };

    window.showNextNews = function(){
        renderCombinedNews();
    };

    function signature(items){
        return JSON.stringify(items.map(function(item){
            return [item.id, item.title, item.body, item.enabled, item.order, item.startAt, item.endAt];
        }));
    }

    async function loadCompanyNews(){
        try{
            const response = await fetch(getCompanyNewsEndpoint(), {cache:'no-store'});
            if(!response.ok) throw new Error('Company news server error');

            const data = await response.json();
            const items = Array.isArray(data) ? data.filter(function(item){
                return item && typeof item.title === 'string' && item.title.trim() !== '';
            }) : [];

            const newSignature = signature(items);
            const changed = newSignature !== lastCompanyNewsSignature;

            companyNewsList = items;
            lastCompanyNewsSignature = newSignature;

            // عند إضافة/تعديل خبر: لا نعيد الدورة من البداية ولا نختصرها.
            // نعيد بناء القائمة مع الحفاظ على موقعنا الحالي، فيدخل الخبر الجديد
            // بالدورة الطبيعية حسب ترتيب order.
            if(changed && typeof bottomMode !== 'undefined' && bottomMode === 'news'){
                const oldIndex = companyNewsIndex;
                const oldLength = combinedNewsList.length;
                combinedNewsList = getCombinedNews();

                if(oldLength === 0){
                    companyNewsIndex = 0;
                }else if(oldIndex >= combinedNewsList.length){
                    companyNewsIndex = 0;
                }else{
                    companyNewsIndex = oldIndex;
                }

                renderCombinedNews();
            }
        }catch(error){
            console.log('Company News Error:', error);
        }
    }

    const style = document.createElement('style');
    style.textContent = `
        .bottom-bar.company-news-active{
            border-color:rgba(244,196,48,0.85);
            box-shadow:0 0 10px rgba(244,196,48,0.18);
        }
        .bottom-bar.company-news-active .bottom-title{
            background:#f4c430;
            color:#0b1b3d;
        }
        .company-news-item{
            color:#f4c430 !important;
        }
        .company-news-separator{
            color:#f4c430 !important;
        }
    `;
    document.head.appendChild(style);

    loadCompanyNews();
    setInterval(loadCompanyNews, COMPANY_NEWS_REFRESH_TIME);

    // Start once after the page's original scripts have initialized.
    setTimeout(function(){
        if(typeof bottomMode !== 'undefined'){
            window.startNews();
        }
    }, 50);
})();
