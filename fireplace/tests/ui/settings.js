var helpers = require('../lib/helpers');
var _ = require('../../node_modules/underscore');

casper.test.begin('Test settings', {
    test: function(test) {
        helpers.startCasper({path: '/settings'});

        casper.waitUntilVisible('.account-settings .persona', function() {
            test.assertNotVisible('.account-settings .logout');
            test.assertNotVisible('.account-settings-save button[type="submit"]');
            test.assertNotVisible('.account-settings .email');
            test.assertNotVisible('.account-settings input[name="display_name"]');
            test.assertNotVisible('.account-settings input[name="enable_recommendations"]');
            helpers.fake_login();
        });

        casper.waitUntilVisible('.account-settings .logout', function() {
            test.assertNotVisible('.account-settings .persona');
            test.assertVisible('.account-settings-save button[type="submit"]');
            test.assertVisible('.account-settings .email');
            test.assertVisible('.account-settings input[name="display_name"]');
            test.assertVisible('.account-settings input[name="enable_recommendations"]');
            casper.fill('.account-settings', {
                display_name: 'hello my name is rob hudson'
            });
            test.assertVisible('.account-settings .newsletter-info');
            test.assert(helpers.checkValidity('.account-settings'),
                        'Account settings form is valid');
            casper.click('.account-settings-save [type="submit"]');

            test.assertEqual(
                casper.getFormValues('.account-settings').display_name,
                'hello my name is rob hudson'
            );

            casper.click('.account-settings-save .logout');
        });

        casper.waitUntilVisible('.account-settings', function() {
            test.assertSelectorHasText('.account-settings-save .login', 'Sign In');
            test.assertSelectorHasText('.account-settings-save .register', 'Register');
            test.assertNotVisible('.account-settings-save .logout');
        });

        helpers.done(test);
    }
});

casper.test.begin('Test settings recommendations', {
    test: function(test) {
        helpers.startCasper({path: '/settings', viewport: 'desktop'});

        helpers.waitForPageLoaded(function() {
            helpers.fake_login();
        });

        function toggleRecommendations() {
            casper.click('#enable_recommendations');
            casper.click('.account-settings-save button[type="submit"]');
        }

        helpers.waitForPageLoaded(function() {
            test.assertNotExists('body.show-recommendations');
            toggleRecommendations();
        });

        casper.waitForSelector('body.show-recommendations', function() {
            // Test submitting with recommendations adds the body class.
            test.assertEqual(
                casper.getFormValues('.account-settings')
                      .enable_recommendations,
                true
            );

            // Test the recommendations tab is visible.
            test.assertVisible('.navbar [data-tab="recommended"]');

            // Test that disabling recommendations hides the tab.
            toggleRecommendations();
        });

        casper.waitForSelector('body:not(.show-recommendations)', function() {
            // Test the body class has been removed and the tab is hidden.
            test.assertNotExists('body.show-recommendations');
            test.assertNotVisible('.navbar [data-tab="recommended"]');

            // Re-enable recommendations.
            toggleRecommendations();
        });

        // Sign out.
        casper.thenClick('.account-settings-save .logout', function() {
            // Test logging out removes the body class.
            test.assertNotExists('body.show-recommendations');
        });

        helpers.done(test);
    }
});

casper.test.begin('Test settings newsletter desktop', {
    test: function(test) {
        helpers.startCasper({viewport: 'desktop'});

        helpers.waitForPageLoaded(function() {
            test.assertNotVisible('.account-settings .newsletter-info');
        });

        helpers.done(test);
    }
});


casper.test.begin('Test settings hide logout if native FxA', {
    test: function(test) {
        helpers.startCasper();

        helpers.waitForPageLoaded(function() {
            helpers.fake_login();
        });

        helpers.waitForPageLoaded(function() {
            test.assertVisible('.logout');
            casper.evaluate(function() {
                document.querySelector('body').classList.add('native-fxa');
            });
            test.assertNotVisible('.account-settings .logout');
        });

        helpers.done(test);
    }
});
