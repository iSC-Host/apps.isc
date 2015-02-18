define('apps_buttons',
    ['apps', 'cache', 'capabilities', 'defer', 'l10n', 'log', 'login',
     'models', 'notification', 'payments', 'requests', 'settings',
     'tracking_events', 'urls', 'user', 'utils', 'views', 'z'],
    function(apps, cache, capabilities, defer, l10n, log, login, models,
             notification, payments, requests, settings,
             tracking_events, urls, user, utils, views, z) {
    var logger = log('buttons');
    var gettext = l10n.gettext;
    var apps_model = models('app');

    function setButton($button, text, cls) {
        revertButton($button, text);
        $button.addClass(cls);
    }

    function revertButton($button, text) {
        $button.removeClass('purchasing installing error spinning');
        text = text || $button.data('old-text');
        $button.find('em').text(text);
    }

    function _handler(func) {
        return function(e) {
            e.preventDefault();
            e.stopPropagation();

            // Fetch the product from either model cache or data attr.
            var $btn = $(this);
            var product = apps_model.lookup($btn.closest('[data-slug]').data('slug')) ||
                          $btn.data('product');
            func.call(this, product);
        };
    }

    var launchHandler = _handler(function(product) {
        apps.launch(product.manifest_url);
        tracking_events.track_app_launch(product);
    });

    function install(product, $button, loginPopup) {
        logger.log('Install requested for', product.name);

        // TODO: Have the API possibly return this (bug 889501).
        product.receipt_required = (product.premium_type !== 'free' &&
                                    product.premium_type !== 'free-inapp');

        // If it's a paid app, ask the user to sign in first.
        if (product.receipt_required && !user.logged_in()) {
            logger.log('Purchase suspended; user needs to log in');

            // Create a blank window here so we can pass it to the login func;
            loginPopup = (!capabilities.navPay) ? utils.openWindow() : undefined;

            return login.login({popupWindow: loginPopup}).done(function() {
                // Once login completes, just call this function again with
                // the same parameters, but re-fetch the button (since the
                // button instance is not the same).
                var new_button = get_button(product.manifest_url);
                install(product, new_button, loginPopup);
            }).fail(function(){
                logger.log('Purchase cancelled; login aborted');
                notification.notification({message: gettext('Payment cancelled.')});
                if (loginPopup) {
                    loginPopup.close();
                }
            });
        }

        // If there isn't a user object on the app, add one.
        if (!product.user) {
            console.warn('User data not available for', product.name);
            product.user = {
                purchased: false,
                installed: false,
                developed: false
            };
        }

        // Create a master deferred for the button action.
        var def = defer.Deferred();

        // Create a reference to the button.
        var $this = $button || $(this);
        var _timeout;

        // If the user has already purchased the app, we do need to generate
        // another receipt but we don't need to go through the purchase flow again.
        if (product.id && user.has_purchased(product.id)) {
            product.payment_required = false;
        }

        if (product.payment_required) {
            // The app requires a payment.
            logger.log('Starting payment flow for', product.name);
            $this.data('old-text', $this.find('em').text());  // Save the old text of the button.
            setButton($this, gettext('Purchasing'), 'purchasing');

            var purchaseOpts = {
                // This will be undefined unless a window was created
                paymentWindow: loginPopup,
            };

            payments.purchase(product, purchaseOpts).then(function() {
                logger.log('Purchase flow completed for', product.name);

                // Update the button to say Install.
                setButton($this, gettext('Install'), 'purchased');
                $this.data('old-text', $this.find('em').text());  // Save the old text of the button.

                // Update the cache to show that the app was purchased.
                user.update_purchased(product.id);

                // Bust the cache for the My Apps page.
                cache.bust(urls.api.url('installed'));
                // Rewrite the cache to allow the user to review the app.
                cache.attemptRewrite(function(key) {
                    return key === urls.api.params('reviews', {app: product.slug});
                }, function(data) {
                    data.user.can_rate = true;
                    return data;
                });

                def.always(function() {
                    // Do a reload to show any reviews privilege changes for bug 838848.
                    views.reload();
                });

                // Start the app's installation.
                start_install();
            }, function() {
                notification.notification({message: gettext('Payment cancelled.')});
                logger.log('Purchase flow rejected for', product.name);
                def.reject();
            }).always(function() {
                if (loginPopup) {
                    // If we created the popup for a login and re-used it for a payment
                    // we now need to close it.
                    logger.log('Closing the popup window');
                    loginPopup.close();
                }
            });
        } else {
            // If a popup was kept open for payments we don't need it
            // now we're starting the install.
            if (loginPopup) {
                logger.log('Closing the popup');
                loginPopup.close();
            }
            // There's no payment required, just start install.
            logger.log('Starting app installation for', product.name);
            // Start the app's installation.
            start_install();
        }

        function start_install() {
            // Track the search term used to find this app, if applicable.
            tracking_events.track_search_term();
            tracking_events.track_app_install_begin(product, $this);

            // Make the button a spinner.
            $this.data('old-text', $this.find('em').text())
                 .addClass('spinning');

            // Temporary timeout for hosted apps until we catch the appropriate
            // download error event for hosted apps (in iframe).
            if (!product.is_packaged && !product.payment_required) {
                _timeout = setTimeout(function() {
                    if ($this.hasClass('spinning')) {
                        logger.log('Spinner timeout for ', product.name);
                        revertButton($this);
                        notification.notification({
                            message: gettext('Sorry, we had trouble fetching this app\'s data. Please try again later.')
                        });
                    }
                }, 25000);
            }

            // If the app has already been installed by the user and we don't
            // need a receipt, just start the app install.
            if (product.id && user.has_installed(product.id) && !product.receipt_required) {
                logger.log('Receipt not required (skipping record step) for', product.name);
                return do_install();
            }

            // This is the data needed to record the app's install.
            var api_endpoint = urls.api.url('record_' + (product.receipt_required ? 'paid' : 'free'));
            var post_data = {app: product.id, chromeless: +capabilities.chromeless};

            // If we don't need a receipt to perform the installation...
            if (!product.receipt_required) {
                // Do the install immediately.
                do_install().done(function() {
                    // ...then record the installation if necessary.
                    if (product.role !== 'langpack') {
                        requests.post(api_endpoint, post_data);
                        // We don't care if it fails or not because the user
                        // has already installed the app.
                    }
                });
                return;
            }

            // Let the API know we're installing.
            requests.post(api_endpoint, post_data).done(function(response) {
                // If the server returned an error, log it and reject the deferred.
                if (response.error) {
                    logger.log('Server returned error: ' + response.error);
                    def.reject();
                    return;
                }

                do_install({data: {'receipts': [response.receipt]}});

            }).fail(function() {
                // L10n: The app's installation has failed, but the problem is temporary.
                notification.notification({
                    message: gettext('Install failed. Please try again later.')
                });

                // Could not record/generate receipt!
                console.error('Could not generate receipt or record install for', product.name);
                def.reject();
            });
        }

        function do_install(data) {
            return apps.install(product, data || {}).done(function(installer) {
                if (product.id) {
                    // Update the cache to show that the user installed the app.
                    user.update_install(product.id);
                    // Bust the cache for the My Apps page.
                    cache.bust(urls.api.url('installed'));
                }

                def.resolve(installer, product, $this);
            }).fail(function(error) {
                if (error) {
                    notification.notification({message: error});
                }
                logger.log('App install deferred was rejected for ', product.name);
                def.reject();
            });
        }

        // After everything has completed, carry out post-install logic.
        def.then(function(installer) {
            // Clear the spinner timeout if one was set.
            if (_timeout) {
                clearTimeout(_timeout);
            }

            // Show the box on how to run the app.
            var $postInstallMsg = $('.post-install-message').show();
            var $postInstallMsgPlat = $postInstallMsg.find(
                '.post-install-message-' + capabilities.os.slug);
            if ($postInstallMsgPlat.length) {
                $postInstallMsg.show();
                $postInstallMsgPlat.show();
            }

            setTimeout(function() {
                // Pass the manifest_url and not the button in case there are
                // multiple instances of the same button on the page.
                mark_installed(product.manifest_url);
            });
            tracking_events.track_app_install_success(product, $this);
            logger.log('Successful install for', product.name);
        }, function() {
            revertButton($this);
            tracking_events.track_app_install_fail(product, $this);
            logger.log('Unsuccessful install for', product.name);
        });

        return def.promise();
    }

    z.page.on('click', '.product.launch', launchHandler)
          .on('click', '.button.product:not(.launch):not(.incompatible)', _handler(install));

    function get_button(manifest_url) {
        return $('.button[data-manifest_url="' + manifest_url.replace(/"/, '\\"') + '"]');
    }

    function mark_installed(manifest_url, $button) {
        var text;
        if (manifest_url) {
            logger.log('Marking as installed', manifest_url);
            $button = get_button(manifest_url);
        }
        if ($button.data('product').role === 'langpack') {
            // Never show the 'Open' text for installed langpacks. Instead, say
            // "Installed" and disable it.
            text = gettext('Installed');
            $button.prop('disabled', true);
        } else {
            // L10n: "Open" as in "Open the app".
            text = gettext('Open');
        }
        setButton($button, text, 'launch install');
        apps.getInstalled();
    }

    function mark_btns_as_installed() {
        /* For each installed app, look for respective buttons and mark as
           ready to launch ("Open"). */
        setTimeout(function() {
            z.apps.forEach(function(app, i) {
                $button = get_button(app);
                if ($button.length) {
                    mark_installed(null, $button);
                }
            });
        });
    }

    function mark_btns_as_uninstalled() {
        /* If an app was uninstalled, revert state of install buttons from
           "Launch" to "Install". */
        apps.getInstalled();
        $('.button.product').each(function(i, button) {
            var $button = $(button);
            // For each install button, check if its respective app is installed.
            if (z.apps.indexOf($button.data('manifest_url')) === -1) {
                // If it is no longer installed, revert button.
                if ($button.hasClass('launch')) {
                    revertButton($button, gettext('Install'));
                }
                $button.removeClass('launch');
            }
        });
    }

    return {
        install: install,
        mark_btns_as_installed: mark_btns_as_installed,
        mark_btns_as_uninstalled: mark_btns_as_uninstalled,
    };
});
