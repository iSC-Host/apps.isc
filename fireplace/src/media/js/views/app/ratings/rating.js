define('views/app/ratings/rating', ['l10n', 'urls'], function(l10n, urls) {

    var gettext = l10n.gettext;

    return function(builder, args) {
        var slug = args[0];
        var id = args[1];

        builder.start('ratings/rating.html', {'slug': slug, id: id});

        builder.z('type', 'leaf');
        builder.z('parent', urls.reverse('app/ratings', [slug]));
        builder.z('title', gettext('App Review'));
    };
});
