define('views/homepage',
    ['capabilities', 'desktop_promo', 'format', 'l10n', 'log', 'jquery',
     'mkt-carousel', 'nunjucks', 'requests', 'salvattore', 'urls', 'utils',
     'utils_local', 'z'],
    function(capabilities, desktopPromo, format, l10n, log, $,
             mktCarousel, nunjucks, requests, salvattore, urls, utils,
             utils_local, z) {
    'use strict';
    var logger = log('homepage');
    var gettext = l10n.gettext;

    z.page.on('click', '.loadmore.feed-item-item button', function() {
        // Manually handle pagination to insert elements into Salvattore.
        // Be careful with above selector to target the homepage only.
        var $btn = $(this);
        var $loadmore = $btn.parent();
        var $btn_clone = $loadmore.clone();
        $loadmore.addClass('loading');

        requests.get($btn.data('url')).done(function(data) {
            $loadmore.remove();

            // Transform the data into elements.
            var elements = data.objects.map(function(item) {
                return $(nunjucks.env.render('feed/feed_item.html',
                                             {item: item}))[0];
            });

            // Insert elements with Salvattore.
            var homeFeed = document.querySelector('.home-feed');
            if (homeFeed) {
                salvattore.append_elements(homeFeed, elements);
            }

            // Render another loadmore button.
            if (data.meta.next) {
                $btn_clone.find('button').attr('data-url',
                    urls.api.base.host(data.meta.next) + data.meta.next);
                homeFeed.parentNode.insertBefore($btn_clone[0], homeFeed.nextSibling);
            }

            z.page.trigger('fragment_loaded');
        });
    });

    return function(builder, args, params) {
        var isDesktop = desktopPromo.isDesktop();

        params = params || {};

        builder.z('title', '');
        builder.z('type', 'root homepage');

        if ('src' in params) {
            delete params.src;
        }

        builder.start('homepage.html', {
            showPromo: isDesktop,
            promoItems: desktopPromo.promoItems
        });

        if (isDesktop) {
            mktCarousel.initialize();
        }

        builder.onload('feed-items', function(data) {
            utils_local.initSalvattore(document.querySelector('.home-feed'));
        });
    };
});
