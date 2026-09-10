/* =====================================================
   Al-Ittihad board: install app + price notifications
   ===================================================== */
(function(){
    'use strict';

    const PUSH_SERVER = 'https://pricing-server-yjam.onrender.com';
    const BOARD_URL = 'https://alittihad1977.github.io/pricing-server/asd.html';
    let deferredInstallPrompt = null;

    function isStandalone(){
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }

    function urlBase64ToUint8Array(base64String){
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
    }

    async function enablePriceNotifications(){
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            return false;
        }

        try {
            const permission = Notification.permission === 'granted'
                ? 'granted'
                : await Notification.requestPermission();

            if(permission !== 'granted') return false;

            const registration = await navigator.serviceWorker.register('./sw.js');
            await navigator.serviceWorker.ready;

            let subscription = await registration.pushManager.getSubscription();

            if(!subscription){
                const keyResponse = await fetch(PUSH_SERVER + '/vapidPublicKey', { cache:'no-store' });
                if(!keyResponse.ok) throw new Error('vapid key unavailable');
                const data = await keyResponse.json();

                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly:true,
                    applicationServerKey:urlBase64ToUint8Array(data.publicKey)
                });
            }

            const subscribeResponse = await fetch(PUSH_SERVER + '/subscribe', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify(subscription)
            });

            if(!subscribeResponse.ok) throw new Error('subscribe failed');

            localStorage.setItem('alittihad_price_notifications','enabled');
            return true;
        } catch(error){
            console.error('Price notifications setup error:', error);
            return false;
        }
    }

    function addStyles(){
        if(document.getElementById('alittihadPwaStyles')) return;
        const style = document.createElement('style');
        style.id = 'alittihadPwaStyles';
        style.textContent = `
#alittihadInstallOverlay,#alittihadNotifyOverlay{
 position:fixed;inset:0;background:rgba(3,10,28,.78);backdrop-filter:blur(5px);
 display:none;align-items:center;justify-content:center;z-index:99999;padding:20px;direction:rtl
}
.alittihad-pwa-card{width:min(430px,94vw);background:#0b1b3d;border:2px solid #f4c430;border-radius:22px;padding:25px 20px;text-align:center;box-shadow:0 15px 50px rgba(0,0,0,.55)}
.alittihad-pwa-card h2{margin:0 0 10px;color:#f4c430;font-size:24px}
.alittihad-pwa-card p{margin:8px 0 18px;color:#fff;font-size:16px;line-height:1.7}
.alittihad-pwa-logo{width:72px;height:72px;object-fit:contain;margin-bottom:8px}
.alittihad-pwa-btn{width:100%;border:0;border-radius:13px;padding:12px;margin-top:8px;font-size:16px;font-weight:bold;cursor:pointer;background:#f4c430;color:#0b1b3d}
.alittihad-pwa-later{background:rgba(255,255,255,.10);color:#fff}
`;
        document.head.appendChild(style);
    }

    function makeOverlay(id, title, text, mainText, laterText){
        if(document.getElementById(id)) return document.getElementById(id);
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.innerHTML = `
          <div class="alittihad-pwa-card">
            <img class="alittihad-pwa-logo" src="https://i.postimg.cc/wvrQMV5X/IMG-20250610-WA0000.png" alt="الاتحاد">
            <h2>${title}</h2>
            <p>${text}</p>
            <button class="alittihad-pwa-btn" data-action="main">${mainText}</button>
            <button class="alittihad-pwa-btn alittihad-pwa-later" data-action="later">${laterText}</button>
          </div>`;
        document.body.appendChild(overlay);
        return overlay;
    }

    function showInstallPrompt(){
        if(isStandalone() || localStorage.getItem('alittihad_install_done') === '1') return;
        addStyles();
        const overlay = makeOverlay(
            'alittihadInstallOverlay',
            'ثبّت تطبيق لوحة الاتحاد',
            'ثبّت اللوحة على جهازك لتفتح بسرعة مثل التطبيق وتبقى جاهزة لمتابعة تحديثات الأسعار.',
            'تثبيت التطبيق',
            'لاحقاً'
        );
        overlay.style.display = 'flex';

        overlay.querySelector('[data-action="main"]').onclick = async function(){
            if(deferredInstallPrompt){
                deferredInstallPrompt.prompt();
                const result = await deferredInstallPrompt.userChoice;
                if(result && result.outcome === 'accepted'){
                    localStorage.setItem('alittihad_install_done','1');
                }
                deferredInstallPrompt = null;
                overlay.style.display = 'none';
            } else {
                alert('من قائمة Chrome اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».');
            }
        };

        overlay.querySelector('[data-action="later"]').onclick = function(){
            overlay.style.display = 'none';
        };
    }

    function showNotificationPrompt(){
        if(Notification.permission === 'granted' || localStorage.getItem('alittihad_price_notifications') === 'enabled') return;
        addStyles();
        const overlay = makeOverlay(
            'alittihadNotifyOverlay',
            'فعّل إشعارات تحديث الأسعار',
            'سيصلك إشعار فور تحديث أسعار الصرف حتى لو كان تطبيق اللوحة مغلقاً.',
            'تفعيل الإشعارات',
            'لاحقاً'
        );
        overlay.style.display = 'flex';

        overlay.querySelector('[data-action="main"]').onclick = async function(){
            const ok = await enablePriceNotifications();
            if(ok) overlay.style.display = 'none';
            else alert('تعذر تفعيل الإشعارات حالياً. تأكد أن إشعارات Chrome مسموحة لهذا الموقع.');
        };
        overlay.querySelector('[data-action="later"]').onclick = function(){
            overlay.style.display = 'none';
        };
    }

    window.addEventListener('beforeinstallprompt', function(event){
        event.preventDefault();
        deferredInstallPrompt = event;
        showInstallPrompt();
    });

    window.addEventListener('appinstalled', function(){
        localStorage.setItem('alittihad_install_done','1');
        const installOverlay = document.getElementById('alittihadInstallOverlay');
        if(installOverlay) installOverlay.style.display = 'none';
        setTimeout(showNotificationPrompt, 700);
    });

    window.addEventListener('load', function(){
        setTimeout(function(){
            if(isStandalone()){
                showNotificationPrompt();
            }
        }, 1200);
    });
})();
