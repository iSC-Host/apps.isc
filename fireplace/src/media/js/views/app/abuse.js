define('views/app/abuse',
    ['capabilities', 'forms', 'l10n', 'notification', 'nunjucks',  'requests',
     'urls', 'utils', 'z'],
    function(caps, forms, l10n, notification, nunjucks, requests, urls,
             utils, z) {
    var gettext = l10n.gettext;
    var notify = notification.notification;

    z.doc.on('submit', '.abuse-form', utils._pd(function(e) {
        // Used for both the report abuse page and the modal.
        var $this = $(this);
        var slug = $this.find('input[name=app]').val();
        var data = utils.getVars($this.serialize());

        forms.toggleSubmitFormState($this);

        requests.post(urls.api.url('app_abuse'), data).done(function(data) {
            notify({message: gettext('Abuse report submitted. Thanks!')});
            if (!caps.widescreen()) {
                z.page.trigger('navigate', urls.reverse('app', [slug]));
            }
        }).fail(function() {
            forms.toggleSubmitFormState($this, true);
            notify({message: gettext('There was an issue submitting your abuse report. Please try again later.')});
        });
    }));

    z.body.on('click', 'a.abuse', function(e) {
        // When clicking on Report Abuse link on detail pagje.
        //   - On mobile, navigate to report abuse page.
        //   - On desktop, show report abuse modal.
        var slug = $(this).closest('.detail').data('slug');

        if (caps.widescreen()) {
            e.preventDefault();
            e.stopPropagation();
            if (!$('mkt-prompt.abuse').length) {
                z.body.append(nunjucks.env.render('_includes/abuse_modal.html', {
                    slug: slug
                }));
            }
        } else {
            z.page.trigger('navigate', [urls.reverse('app/abuse', [slug])]);
        }
    });

    return function(builder, args) {
        builder.z('type', 'leaf');
        builder.z('parent', urls.reverse('app', [args[0]]));
        // L10n: Report abuse regarding an app.
        builder.z('title', gettext('Report Abuse'));

        builder.start('app/abuse.html', {
            slug: args[0]
        });
    };
});
