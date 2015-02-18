/*
    Mock window.navigator.mozApps.
    mozApps API return request objects. For our mock, in most cases we will
    call the requests' callbacks instantly via setIntervals.
*/
function initialize() {
    var readyInterval = setInterval(function() {
        // Interval to make sure we initialize only after the window is ready.
        // If we do it too soon, then the window will override our mock with
        // the standard window.navigator.
        if (casper.evaluate(_initialize)) {
            clearInterval(readyInterval);
        }
    }, 50);

    function _initialize() {
        if (document.readyState !== 'complete') {
            return false;
        }

        // Keep track of installed apps.
        var manifests = [];

        window.navigator.mozApps = {
            // Mock app installs.
            getInstalled: function() {
                var request = {
                    result: manifests.map(function(manifest) {
                        return {
                            manifestURL: manifest,
                            launch: function() {
                                console.log('[mozApps] Launching ' + manifest);
                            }
                        };
                    })
                };

                setTimeout(function() {
                    if (request.onsuccess && request.onsuccess.constructor === Function) {
                        request.onsuccess();
                    }
                });

                return request;
            },
            getSelf: function() {
                var request = {};

                setTimeout(function() {
                    if (request.onsuccess && request.onsuccess.constructor === Function) {
                        request.onsuccess();
                    }
                });

                return request;
            },
            install: function(manifest) {
                var request = {
                    result: {
                        installState: 'installed',
                        ondownloaderror: function() {
                            // If you want to mock a download error.
                        }
                    },
                    onerror: function() {
                        // If you want to mock a request error.
                    }
                };

                setTimeout(function() {
                    if (request.onsuccess && request.onsuccess.constructor === Function) {
                        request.onsuccess();
                    }
                });

                manifests.push(manifest);

                return request;
            },
        };

        window.navigator.mozApps.installPackage = window.navigator.mozApps.install;
        console.log('[mozApps] Mock mozApps initialized');
        return true;
    }
}

module.exports = {
    initialize: initialize
};
