/*
    The main file that initializes the app.
    Only put initialization code in here. Everything else should go into
    separate and appropriate modules. This is not your diaper.
*/
console.log('Mozilla(R) FP-MKT (R) 1.0');
console.log('   (C)Copyright Mozilla Corp 1998-2015');
console.log('');
console.log('64K High Memory Area is available.');

define(
    'main',
    [
        'underscore',
        'jquery',
        'polyfill', // Must be early.
        'document-register-element',
        'helpers',  // Must come before mostly everything else.
        'helpers_local',
        'apps_buttons',
        'app_list',
        'cache',
        'capabilities',
        'consumer_info',
        'compatibility_filtering_select',
        'content-ratings',
        'flipsnap',
        'forms',
        'image-deferrer',
        'image-deferrer-mkt',
        'l10n',
        'lightbox',
        'log',
        'login',
        'marketplace-elements',
        'models',
        'navbar',
        'navigation',
        'newsletter',
        'overlay',
        'perf_events',
        'perf_helper',
        'previews',
        'regions',
        'requests',
        'reviews',
        'settings',
        'site_config',
        'storage',
        'templates',
        'tracking',
        'tracking_events',
        'urls',
        'user',
        'user_helpers',
        'utils',
        'utils_local',
        'views',
        'webactivities',
        'z'
    ],
function(_) {
    var apps = require('apps');
    var buttons = require('apps_buttons');
    var capabilities = require('capabilities');
    var consumer_info = require('consumer_info');
    var flipsnap = require('flipsnap');
    var format = require('format');
    var $ = require('jquery');
    var settings = require('settings');
    var siteConfig = require('site_config');
    var l10n = require('l10n');
    var newsletter = require('newsletter');
    var nunjucks = require('templates');
    var regions = require('regions');
    var urls = require('urls');
    var user = require('user');
    var utils = require('utils');
    var utils_local = require('utils_local');
    var z = require('z');

    var logger = require('log')('mkt');
    var gettext = l10n.gettext;

    logger.log('Package version: ' + (settings.package_version || 'N/A'));

    if (capabilities.device_type() === 'desktop') {
        z.body.addClass('desktop');
    }

    var start_time = performance.now();

    z.body.addClass('html-' + l10n.getDirection());

    if (settings.body_classes) {
        z.body.addClass(settings.body_classes);
    }

    if (!utils_local.isSystemDateRecent()) {
        // System date checking.
        z.body.addClass('error-overlaid')
            .append(nunjucks.env.render('errors/date-error.html'))
            .on('click', '.system-date .try-again', function() {
                if (utils_local.isSystemDateRecent()) {
                    window.location.reload();
                }
            });
    } else {
        utils_local.checkOnline().fail(function() {
            logger.log('We are offline. Showing offline message');
            z.body.addClass('error-overlaid')
                .append(nunjucks.env.render('errors/offline-error.html'))
                .on('click', '.offline .try-again', function() {
                    logger.log('Re-checking online status');
                    utils_local.checkOnline().done(function(){
                        logger.log('Reloading');
                        window.location.reload();
                     }).fail(function() {
                        logger.log('Still offline');
                    });
                });
        });
    }

    z.page.one('loaded', function() {
        if (z.context.hide_splash !== false) {
            // Remove the splash screen.
            logger.log('Hiding splash screen (' +
                        ((performance.now() - start_time) / 1000).toFixed(6) +
                        's)');
            var splash = $('#splash-overlay').addClass('hide');
            z.body.removeClass('overlayed').addClass('loaded');
            setTimeout(function() {
                z.page.trigger('splash_removed');
            }, 1500);
        } else {
            logger.log('Retaining the splash screen for this view');
        }
    });

    // This lets you refresh within the app by holding down command + R.
    if (capabilities.chromeless) {
        window.addEventListener('keydown', function(e) {
            if (e.keyCode == 82 && e.metaKey) {
                window.location.reload();
            }
        });
    }

    if (capabilities.webApps) {
        // Mark installed apps, look for Marketplace update. If in packaged
        // app, wait for the iframe to load. Else we use direct installer and
        // just need to wait for normal loaded event.
        var is_packaged_app = window.location.protocol === 'app:';
        var is_iframed_app = window.top !== window.self;  //  Good enough.
        var event_for_apps = is_packaged_app ? 'iframe-install-loaded' : 'loaded';
        z.page.one(event_for_apps, function() {
            apps.getInstalled().done(function() {
                z.page.trigger('mozapps_got_installed');
                buttons.mark_btns_as_installed();
            });

            var manifest_url = settings.manifest_url;
            var email = user.get_setting('email') || '';
            // Need the manifest url to check for update.  Only want to show
            // update notification banner if inside an app. Only to mozilla.com
            // users for now.
            if (manifest_url && (is_packaged_app || is_iframed_app) &&
                email.substr(-12) === '@mozilla.com') {
                apps.checkForUpdate(manifest_url).done(function(result) {
                    if (!result) {
                        return;
                    }
                    z.body.on('click', '#marketplace-update-banner .button', utils._pd(function() {
                        var $button = $(this);
                        // Deactivate "remember" on dismiss button so that it
                        // shows up for next update if user clicks on it now
                        // they chose to apply the update.
                        $button.closest('mkt-banner').get(0).dismiss = '';
                        $button.addClass('spin');
                        apps.applyUpdate(manifest_url).done(function() {
                            $('#marketplace-update-banner span').text(gettext(
                                'The next time you start the Firefox Marketplace app, you’ll see the updated version!'));
                            $button.remove();
                        });
                    }));
                    $('#site-nav').after(nunjucks.env.render('marketplace-update.html'));
                });
            } else {
                logger.log('Not in app or manifest_url is absent, ' +
                            'or not a mozilla.com user, skipping update check.');
            }
        });

        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                // Refresh list of installed apps in case user uninstalled apps
                // and switched back.
                if (user.logged_in()) {
                    consumer_info.fetch(true);
                }
                apps.getInstalled().done(buttons.mark_btns_as_uninstalled);
            }
        }, false);
    }

    // Do some last minute template compilation.
    z.page.on('reload_chrome', function() {
        logger.log('Reloading chrome');
        var user_helpers = require('user_helpers');
        var context = {
            user_region: user_helpers.region('restofworld'),
            z: z
        };
        _.extend(context, newsletter.context());
        $('#site-header').html(
            nunjucks.env.render('header.html', context));
        $('#site-footer').html(
            nunjucks.env.render('footer.html', context));

        if (!navigator.mozApps && !navigator.userAgent.match(/googlebot/i)) {
            if (!document.getElementById('incompatibility-banner')) {
                logger.log('Adding incompatibility banner');
                $('#site-nav').after(nunjucks.env.render('incompatible.html'));
            }
        } else if (capabilities.osXInstallIssues) {
            if ($('mkt-banner[name="mac-banner"]').length === 0) {
                $('#site-nav').after(
                    nunjucks.env.render('_includes/os_x_banner.html'));
            }
        }

        var logged_in = user.logged_in();

        if (!logged_in) {
            z.body.removeClass('show-recommendations');
        }

        siteConfig.promise.then(function() {
            if (capabilities.nativeFxA() || capabilities.yulelogFxA()) {
                // Might want to style things differently for native FxA,
                // like log out through settings instead of Marketplace
                // (bug 1073177), but wait for switches to load.
                z.body.addClass('native-fxa');
            }
        });

        consumer_info.promise.then(function() {
            // Re-render footer region if necessary.
            var current_region = user_helpers.region('restofworld');
            if (current_region !== context.user_region) {
                logger.log('Region has changed from ' + context.user_region +
                            ' to ' + current_region + ' since we rendered ' +
                            'the footer, updating region in footer.');
                $('#site-footer span.region')
                    .removeClass('region-' + context.user_region)
                    .addClass('region-' + current_region)
                    .text(regions.REGION_CHOICES_SLUG[current_region]);
            }
            // To show or not to show the recommendations nav.
            if (logged_in && user.get_setting('enable_recommendations')) {
                z.body.addClass('show-recommendations');
            }
        });

        z.body.toggleClass('logged-in', logged_in);
        z.page.trigger('reloaded_chrome');
    }).trigger('reload_chrome');

    z.page.on('before_login before_logout', function() {
        require('cache').purge();
    });

    z.body.on('click', '.site-header .back', function(e) {
        e.preventDefault();
        logger.log('← button pressed');
        require('navigation').back();
    });

    window.addEventListener(
        'resize',
        _.debounce(function() {z.doc.trigger('saferesize');}, 200),
        false
    );

    consumer_info.promise.done(function() {
        logger.log('Triggering initial navigation');
        if (!z.spaceheater) {
            z.page.trigger('navigate', [window.location.pathname + window.location.search]);
        } else {
            z.page.trigger('loaded');
        }
    });

    require('requests').on('deprecated', function() {
        // Divert the user to the deprecated view.
        z.page.trigger('divert', [urls.reverse('deprecated')]);
        throw new Error('Cancel navigation; deprecated client');
    });

    logger.log('Initialization complete');
});
