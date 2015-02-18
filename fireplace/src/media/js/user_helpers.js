define('user_helpers', ['regions', 'user', 'utils'],
       function(regions, user, utils) {

    var initialArgs = utils.getVars();

    var region_geoip = null;

    function region(default_, ignore_geoip) {
        if ('region' in initialArgs &&
            initialArgs.region &&
            regions.REGION_CHOICES_SLUG[initialArgs.region]) {
            return initialArgs.region;
        }
        return user.get_setting('region_override') ||
               user.get_setting('region_sim') ||
               region_geoip ||
               (!ignore_geoip && user.get_setting('region_geoip')) ||
               default_ ||
               '';
    }

    function carrier() {
        if ('carrier' in initialArgs) {
            return initialArgs.carrier;
        }
        return user.get_setting('carrier_override') ||
               user.get_setting('carrier_sim') ||
               '';
    }

    function lang() {
        return (navigator.l10n && navigator.l10n.language) ||
            navigator.language ||
            navigator.userLanguage;
    }

    return {
        carrier: carrier,
        lang: lang,
        region: region,
        set_region_geoip: function(region) {
            region_geoip = region;
            user.update_settings({region_geoip: region});
        }
    };
});
