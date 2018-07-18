require('test/helpers/prebidGlobal.js');

var testsContext = require.context('.', true, /justpremiumBidAdapter_spec$/);
testsContext.keys().forEach(testsContext);
