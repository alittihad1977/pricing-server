/*
 QR rotation - شركة الاتحاد
 لا يلمس الأسعار أو تحديثاتها
 */
(function(){
    'use strict';

    const QR_CHANGE_TIME = 15000;
    const WHATSAPP_QR_IMAGE = 'PUT_WHATSAPP_QR_IMAGE_HERE';

    function addWhatsappQr(){
        const old = document.getElementById('whatsappQrCode');
        if(old) return;

        const box = document.createElement('div');
        box.id = 'whatsappQrCode';
        box.innerHTML = '<div class="qr-label">قناة واتساب</div><img src="'+WHATSAPP_QR_IMAGE+'">';
        document.body.appendChild(box);

        const style = document.createElement('style');
        style.textContent = `
        #whatsappQrCode{
            position:fixed;
            left:12px;
            bottom:45px;
            z-index:2501;
            width:142px;
            padding:7px;
            background:#fff;
            border:2px solid #f4c430;
            border-radius:10px;
            display:none;
        }
        #whatsappQrCode img{
            width:124px;
            height:124px;
            display:block;
        }
        #whatsappQrCode .qr-label{
            color:#0b1b3d;
            text-align:center;
            font-size:11px;
            font-weight:bold;
        }`;
        document.head.appendChild(style);
    }

    function startQrRotation(){
        const board = document.getElementById('boardQrCode');
        const whatsapp = document.getElementById('whatsappQrCode');
        if(!board || !whatsapp) return;

        let showWhatsapp = false;

        setInterval(function(){
            showWhatsapp = !showWhatsapp;
            board.style.display = showWhatsapp ? 'none' : 'block';
            whatsapp.style.display = showWhatsapp ? 'block' : 'none';
        }, QR_CHANGE_TIME);
    }

    addWhatsappQr();
    setTimeout(startQrRotation,1000);
})();
