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

    function addQrCode(){
        if(document.getElementById('boardQrCode')) return;

        const rows = [
            '00000000000000000000000000000000000000000',
            '00000000000000000000000000000000000000000',
            '00000000000000000000000000000000000000000',
            '00000000000000000000000000000000000000000',
            '00001111111000010000101101010011111110000',
            '00001000001000110001000011101010000010000',
            '00001011101011111010101111100010111010000',
            '00001011101010111000010010101010111010000',
            '00001011101011111111111110110010111010000',
            '00001000001011010000010001001010000010000',
            '00001111111010101010101010101011111110000',
            '00000000000011101010101001110000000000000',
            '00001011111000101110010110100011111000000',
            '00001010000010001100011101010011011110000',
            '00000100011100110111000010001100101100000',
            '00001110010100110100000111000110111000000',
            '00001011111110111011110000000001110000000',
            '00001000010101000001001110010010001110000',
            '00001011111001011111110001001111100100000',
            '00001011110011111001000111011110111000000',
            '00000011101101010001010110100101100010000',
            '00000101010111100010111100010011011110000',
            '00001111001100011111100010100111101100000',
            '00001000100110100011101001101101111110000',
            '00001001001001111101001100110101110110000',
            '00001010000010101001111101010110000010000',
            '00001001111101111010001001000000011100000',
            '00001000110001111110100011100101111110000',
            '00001001011010110110110010101111100100000',
            '00000000000011101010110101001000101010000',
            '00001111111001011101010011011010101000000',
            '00001000001011110001011001111000111110000',
            '00001011101010100100100000101111110110000',
            '00001011101011010001001111101100101110000',
            '00001011101011100011100011110011010000000',
            '00001000001001001011001101000000111000000',
            '00001111111010000111010010011111000100000',
            '00000000000000000000000000000000000000000',
            '00000000000000000000000000000000000000000',
            '00000000000000000000000000000000000000000',
            '00000000000000000000000000000000000000000'
        ];

        const card = document.createElement('div');
        card.id = 'boardQrCode';
        card.innerHTML = '<div class="qr-label">امسح للوصول للوحة</div><div class="qr-grid" aria-label="رمز QR للوحة التسعير"></div>';

        const grid = card.querySelector('.qr-grid');
        rows.join('').split('').forEach(function(bit){
            const cell = document.createElement('span');
            cell.className = bit === '1' ? 'qr-black' : 'qr-white';
            grid.appendChild(cell);
        });

        document.body.appendChild(card);
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
        #boardQrCode{
            position:fixed;
            left:12px;
            bottom:45px;
            z-index:2500;
            width:142px;
            padding:7px;
            background:#fff;
            border:2px solid #f4c430;
            border-radius:10px;
            box-shadow:0 0 14px rgba(244,196,48,0.28);
            direction:rtl;
        }
        #boardQrCode .qr-label{
            color:#0b1b3d;
            background:#fff;
            text-align:center;
            font-size:11px;
            font-weight:bold;
            line-height:16px;
            margin-bottom:4px;
            white-space:nowrap;
        }
        #boardQrCode .qr-grid{
            width:124px;
            height:124px;
            display:grid;
            grid-template-columns:repeat(41,1fr);
            grid-template-rows:repeat(41,1fr);
            background:#fff;
        }
        #boardQrCode .qr-grid span{display:block;}
        #boardQrCode .qr-black{background:#000;}
        #boardQrCode .qr-white{background:#fff;}
        @media screen and (max-width:900px){
            #boardQrCode{
                left:6px;
                bottom:32px;
                width:94px;
                padding:4px;
                border-width:1px;
                border-radius:7px;
            }
            #boardQrCode .qr-label{
                font-size:7px;
                line-height:10px;
                margin-bottom:2px;
            }
            #boardQrCode .qr-grid{
                width:84px;
                height:84px;
            }
        }
    `;
    document.head.appendChild(style);

    addQrCode();
    loadCompanyNews();
    setInterval(loadCompanyNews, COMPANY_NEWS_REFRESH_TIME);

    // Start once after the page's original scripts have initialized.
    setTimeout(function(){
        if(typeof bottomMode !== 'undefined'){
            window.startNews();
        }
    }, 50);
})();
