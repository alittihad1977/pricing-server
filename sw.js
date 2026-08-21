self.addEventListener("push", function(event) {

    let data = {};

    try {

        data = event.data
            ? event.data.json()
            : {};

    } catch (error) {

        data = {};

    }


    const title =
        data.title ||
        "شركة الاتحاد 💰";


    const body =
        data.body ||
        "تم تحديث أسعار الصرف 🔔";


    const notificationUrl =
        (
            data.data &&
            data.data.url
        )
        ||
        data.url
        ||
        "https://alittihad1977.github.io/pricing-server/asd.html";


    const options = {

        body: body,

        icon:
            "https://i.postimg.cc/wvrQMV5X/IMG-20250610-WA0000.png",

        badge:
            "https://i.postimg.cc/wvrQMV5X/IMG-20250610-WA0000.png",

        tag:
            data.tag ||
            "al-ittihad-prices",

        renotify: true,

        requireInteraction: false,

        vibrate: [
            200,
            100,
            200
        ],

        data: {

            url:
                notificationUrl

        }

    };


    event.waitUntil(

        self.registration.showNotification(
            title,
            options
        )

    );

});


/* =====================================================
   الضغط على الإشعار
   ===================================================== */

self.addEventListener(
    "notificationclick",
    function(event) {

        event.notification.close();


        const url =
            event.notification.data &&
            event.notification.data.url
                ? event.notification.data.url
                : "https://alittihad1977.github.io/pricing-server/asd.html";


        event.waitUntil(

            clients.matchAll({

                type: "window",

                includeUncontrolled: true

            }).then(function(clientList) {


                for (
                    const client
                    of clientList
                ) {

                    if (
                        "focus" in client
                    ) {

                        return client.focus();

                    }

                }


                if (
                    clients.openWindow
                ) {

                    return clients.openWindow(
                        url
                    );

                }

            })

        );

    }
);
