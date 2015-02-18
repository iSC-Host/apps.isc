/*
    Provides the apps module, a wrapper around navigator.mozApps
*/
define('apps',
    ['capabilities', 'defer', 'installer_direct', 'installer_iframe', 'l10n', 'log', 'nunjucks', 'settings', 'underscore', 'utils'],
    function(capabilities, defer, installer_direct, installer_iframe, l10n, log, nunjucks, settings, _, utils) {
    'use strict';
    var gettext = l10n.gettext;
    var console = log('apps');
    var installer;

    /*
      Determine which installer to use.

      We *need* to use https://m.f.c. origin to install apps.
      - In the packaged app, protocol is app:, we need to use the iframe
        installer to get the right origin.
      - In the iframed app or browser, protocol is https:, we can use the
        direct installer as the origin should already be the right one.
      - When testing locally, the protocol is https: or http:, we also use the
        direct installer, it makes things simpler to test.
    */
    if (window.location.protocol === 'app:') {
        installer = installer_iframe;
        installer.initialize_iframe();
    } else {
        installer = installer_direct;
    }

    function install(product, opt) {
        /*
           apps.install(manifest_url, options)

           This requires at least one apps-error-msg div to be present.

           See also: https://developer.mozilla.org/docs/DOM/Apps.install

           data -- optional dict to pass as navigator.apps.install(url, data, ...)
           success -- optional callback for when app installation was successful
           error -- optional callback for when app installation resulted in error
           navigator -- something other than the global navigator, useful for testing
        */
        var def = defer.Deferred();

        // Bug 996150 for packaged Marketplace installing packaged apps.
        installer.install(product, opt).done(function(result, product) {
            def.resolve(result, product);
        }).fail(function(message, error) {
            def.reject(message, error);
        });

        return def.promise();
    }

    function getInstalled() {
        return installer.getInstalled();
    }

    function launch(manifestURL) {
        return installer.launch(manifestURL);
    }

    function checkForUpdate(manifestURL) {
        return installer.checkForUpdate(manifestURL);
    }

    function applyUpdate(manifestURL) {
        return installer.applyUpdate(manifestURL);
    }

    var COMPAT_REASONS = '__compat_reasons';
    var use_compat_cache = true;
    function incompat(product) {
        /*
           apps.incompat(app_object)

           If the app is compatible, this function returns a falsey value.
           If the app is incompatible, a list of reasons why
           (plaintext strings) is returned.

           If you don't want to use the cached values, run the following
           command in your console:

           require('apps')._use_compat_cache(false);
        */
        // If the never_incompat setting is true, never disable the buttons.
        if (settings.never_incompat) {
            return;
        }

        // Cache incompatibility reasons.
        if (use_compat_cache && COMPAT_REASONS in product) {
            return product[COMPAT_REASONS];
        }

        var reasons = [];
        var device = capabilities.device_type();
        if (product.payment_required && !product.price) {
            reasons.push(gettext('Not available for your region'));
        }
        if (!capabilities.webApps ||
            (!capabilities.packagedWebApps && product.is_packaged) ||
            !_.contains(product.device_types, device)) {
            reasons.push(gettext('Not available for your platform'));
        }

        product[COMPAT_REASONS] = reasons.length ? reasons : undefined;
        return product[COMPAT_REASONS];
    }

    return {
        applyUpdate: applyUpdate,
        checkForUpdate: checkForUpdate,
        getInstalled: getInstalled,
        launch: launch,
        incompat: incompat,
        install: install,
        _use_compat_cache: function(val) {use_compat_cache = val;}
    };
});
