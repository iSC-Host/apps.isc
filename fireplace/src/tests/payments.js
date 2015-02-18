(function() {

var assert = require('assert');
var eq_ = assert.eq_;
var contains = assert.contains;
var mock = assert.mock;
var defer = require('defer');
var logger = require('log')('tests/payments');


function FakeFxPay() {}

FakeFxPay.prototype.init = function(opt) {
    opt.oninit();
};

FakeFxPay.prototype.purchase = function(productId, callback) {
    callback();
};


function FakeRequests() {
    this.webpayJWT = this._makeJWT({typ: 'mozilla/payments/pay/v1'});
    this.promiseToPost = null;
}

FakeRequests.prototype._makeJWT = function(payRequest) {
    if (!payRequest) {
        payRequest = {typ: 'mozilla/payments/pay/v1'};
    }
    return '<algo>.' + btoa(JSON.stringify(payRequest)) + '.<sig>';
};

FakeRequests.prototype.post = function() {
    // When the Fireplace adapter posts to the API it is generating a
    // JWT to begin the purchase.
    var response = {
        webpayJWT: this.webpayJWT,
        productId: '<productId>',
        contribStatusURL: '/transaction/status',
    };
    if (!this.promiseToPost) {
        this.promiseToPost = defer.Deferred().resolve(response).promise();
    }
    return this.promiseToPost;
};

FakeRequests.prototype.get = function() {
    // When the Fireplace adapter makes a get request it is checking the
    // status of the transaction.
    var response = {
        // The transaction has been verified and has completed successfully.
        status: 'complete',
    };
    return defer.Deferred().resolve(response).promise();
};


function fakeDeps() {
    return {
        requests: new FakeRequests(),
        notification: {notification: function() {}},
        settings: {},
    };
}


function PaymentWindow() {
    this.location = '';
    this.closed = false;
    this.close = function() {};
}


function FakeFireplaceWindow() {
    this.origin = 'https://marketplace.firefox.com';
    this.open = function() {
        this.paymentWindow = new PaymentWindow();
        return this.paymentWindow;
    };
    this.addEventListener = function(eventType, handler) {
        logger.log('calling handler for:', eventType);
        // Simulate Webpay's postMessage back to fxpay.
        handler({
            origin: this.origin,
            data: {
                // Indicate that the user payment flow is
                // finished. Next fxpay will verify the transaction.
                status: 'ok',
            }
        });
    };
    this.removeEventListener = function() {};
}


function FakeProduct() {
    this.slug = 'some-slug';
    this.payment_required = true;
}


function purchaseOptions(opt) {
    opt = opt || {};
    return {
        fxpaySettings: {
            mozApps: null,
            mozPay: null,
            window: opt.fakeWindow || new FakeFireplaceWindow(),
            // On Firefox there is some difference in fxpay's scope
            // that causes fxpay.init() not to clear this. Hmm.
            initError: null,
        }
    };
}


test('payments: complete payment successfully', function(done, fail) {
    mock(
        'payments',
        fakeDeps(),
        function(payments) {
            var product = new FakeProduct();
            payments.purchase(product, purchaseOptions()).done(function() {
                logger.log('payment.purchase() is done');
                done();
            }).fail(function(_, product, reason) {
                logger.error('payment.purchase() failed:', reason);
                fail(reason);
            });
        },
        fail
    );
});

test('payments: product already purchased', function(done, fail) {
    var deps = fakeDeps();

    // Reject the JWT post with a 409 response.
    deps.requests.promiseToPost = defer.Deferred().reject({}, null, 409).promise();

    deps.requests.get = function() {
        throw new Error(
            'no need to GET transaction status because the app has already been purchased');
    };

    mock(
        'payments',
        deps,
        function(payments) {
            var product = new FakeProduct();
            payments.purchase(product, purchaseOptions()).done(function() {
                logger.log('payment.purchase() is done');
                done();
            }).fail(function(_, product, reason) {
                logger.error('payment.purchase() failed:', reason);
                fail(reason);
            });
        },
        fail
    );
});

test('payments: server error', function(done, fail) {
    var deps = fakeDeps();

    // Reject the JWT post with a server error.
    deps.requests.promiseToPost = defer.Deferred().reject({}, null, 500).promise();

    mock(
        'payments',
        deps,
        function(payments) {
            var product = new FakeProduct();
            payments.purchase(product, purchaseOptions()).done(function() {
                logger.log('payment.purchase() is done');
                fail('unexpected success');
            }).fail(function(_, product, reason) {
                logger.log('payment.purchase() failed:', reason);
                eq_(reason, 'MKT_CANCELLED');
                done();
            });
        },
        fail
    );
});

test('payments: product cannot be purchased', function(done, fail) {
    var deps = fakeDeps();
    deps.fxpay = {
        init: function() {},
        purchase: function() {
            throw new Error('fxpay.purchase() should not be called');
        }
    };

    mock(
        'payments',
        deps,
        function(payments) {
            var product = new FakeProduct();
            product.payment_required = false;

            payments.purchase(product, purchaseOptions()).done(function() {
                logger.log('payment.purchase() is done');
                done();
            }).fail(function(_, product, reason) {
                logger.error('payment.purchase() failed:', reason);
                fail(reason);
            });
        },
        fail
    );
});

test('payments: can add development pay providers', function(done, fail) {
    var deps = fakeDeps();

    deps.settings.dev_pay_providers = {
        'mozilla-dev': 'http://mozilla-dev/pay?req={jwt}',
    }

    deps.requests.webpayJWT = deps.requests._makeJWT({typ: 'mozilla-dev'});

    var fakeWindow = new FakeFireplaceWindow();
    fakeWindow.origin = 'http://mozilla-dev';

    mock(
        'payments',
        deps,
        function(payments) {
            var product = new FakeProduct();
            payments.purchase(product,
                              purchaseOptions({fakeWindow: fakeWindow})).done(function() {
                logger.log('payment.purchase() is done');
                // Make sure that our new setting caused fxpay to start a payment
                // at the configured URL.
                contains(fakeWindow.paymentWindow.location, fakeWindow.origin);
                done();
            }).fail(function(_, product, reason) {
                logger.error('payment.purchase() failed:', reason);
                fail(reason);
            });
        },
        fail
    );
});

test('payments: can add local pay providers', function(done, fail) {
    var deps = fakeDeps();

    deps.settings.local_pay_providers = {
        'mozilla-local': 'http://mozilla-local/pay?req={jwt}',
    }

    deps.requests.webpayJWT = deps.requests._makeJWT({typ: 'mozilla-local'});

    var fakeWindow = new FakeFireplaceWindow();
    fakeWindow.origin = 'http://mozilla-local';

    mock(
        'payments',
        deps,
        function(payments) {
            var product = new FakeProduct();
            payments.purchase(product,
                              purchaseOptions({fakeWindow: fakeWindow})).done(function() {
                logger.log('payment.purchase() is done');
                // Make sure that our new setting caused fxpay to start a payment
                // at the configured URL.
                contains(fakeWindow.paymentWindow.location, fakeWindow.origin);
                done();
            }).fail(function(_, product, reason) {
                logger.error('payment.purchase() failed:', reason);
                fail(reason);
            });
        },
        fail
    );
});

test('payments: unknown fxpay error', function(done, fail) {
    var deps = fakeDeps();

    deps.fxpay = {
        configure: function() {},
        init: function() {},
        purchase: function(productId, callback) {
            // Simulate an arbitrary fxpay error.
            callback('SOME_FXPAY_ERROR');
        }
    };

    mock(
        'payments',
        deps,
        function(payments) {
            var product = new FakeProduct();
            payments.purchase(product, purchaseOptions()).done(function() {
                logger.log('payment.purchase() is done');
                fail('unexpected success');
            }).fail(function(_, product, reason) {
                logger.log('payment.purchase() failed:', reason);
                eq_(reason, 'MKT_CANCELLED');
                done();
            });
        },
        fail
    );
});

})();
