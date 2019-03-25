import { expect } from 'chai'
import { spec, pixel } from 'modules/justpremiumBidAdapter'

let adUnits = [{
  adUnitCode: 'div-1',
  bidder: 'justpremium',
  params: {
    zone: 28313,
    allow: ['lb', 'wp']
  }
},
{
  adUnitCode: 'div-2',
  bidder: 'justpremium',
  params: {
    zone: 32831,
    exclude: ['sa']
  }
}]

let bidderRequest = {
  gdprConsent: {
    consentString: 'example_consent',
    gdprApplies: true,
  }
}

let validBidRequests = [{
  adUnitCode: 'div-1',
  auctionId: '6074929e-6b3b-47a8-a7fb-b88fd55eab97',
  bidId: '229ad4743533f3',
  bidRequestsCount: 1,
  bidder: 'justpremium',
  bidderRequestId: '18708daa69a3cd',
  crumbs: {
    pubcid: 'bceef426-e104-4fcd-997d-c000a1acad82'
  },
  mediaTypes: {
    banner: {
      sizes: [970, 250]
    }
  },
  sizes: [970, 250],
  params: {
    zone: 28313,
    allow: ['lb', 'wp'],
    sizes: [970, 250],
    transactionId: 'e68063a4-003f-43a4-8c29-f7ec5c42138e'
  }
}, {
  adUnitCode: 'div-2',
  auctionId: '6074929e-6b3b-47a8-a7fb-b88fd55eab97',
  bidId: '229ad4743533f3',
  bidRequestsCount: 1,
  bidder: 'justpremium',
  bidderRequestId: '18708daa69a3cd',
  crumbs: {
    pubcid: 'bceef426-e104-4fcd-997d-c000a1acad82'
  },
  mediaTypes: {
    banner: {
      sizes: [970, 250]
    }
  },
  sizes: [970, 250],
  params: {
    zone: 28313,
    exclude: ['lb', 'wp'],
    sizes: [970, 250],
    transactionId: 'e68063a4-003f-43a4-8c29-f7ec5c42138e'
  }
}]

describe('justpremium adapter', function () {
  describe('isBidRequestValid', function () {
    it('Verifies bidder code', function () {
      expect(spec.code).to.equal('justpremium')
    })

    it('Verify build request', function () {
      expect(spec.isBidRequestValid({bidder: 'justpremium', params: {}})).to.equal(false)
      expect(spec.isBidRequestValid({})).to.equal(false)
      expect(spec.isBidRequestValid(adUnits[0])).to.equal(true)
      expect(spec.isBidRequestValid(adUnits[1])).to.equal(true)
    })
  })

  describe('buildRequests', function () {
    it('Verify build request and parameters', function () {
      const request = spec.buildRequests(validBidRequests, bidderRequest)

      expect(request.method).to.equal('POST')
      expect(request.url).to.match(/pre.ads.justpremium.com\/v\/2.1\/t\/xhr/)

      const jpxRequest = JSON.parse(request.data)
      expect(jpxRequest).to.not.equal(null)
      expect(jpxRequest.zone).to.not.equal('undefined')
      expect(jpxRequest.hostname).to.equal(top.document.location.hostname)
      expect(jpxRequest.protocol).to.equal(top.document.location.protocol.replace(':', ''))
      expect(jpxRequest.sw).to.equal(window.top.screen.width)
      expect(jpxRequest.sh).to.equal(window.top.screen.height)
      expect(jpxRequest.ww).to.equal(window.top.innerWidth)
      expect(jpxRequest.wh).to.equal(window.top.innerHeight)
      expect(jpxRequest.sizes).to.not.equal('undefined')
      expect(jpxRequest.version.prebid).to.equal('$prebid.version$')
      expect(jpxRequest.version.jp_adapter).to.equal('1.4')

      expect(jpxRequest.slots[0].code).to.equal('div-1')
      expect(jpxRequest.slots[0].count).to.equal(1)
      expect(jpxRequest.slots[0].id).to.equal('229ad4743533f3')
      expect(jpxRequest.slots[0].type).to.equal('banner')
      expect(jpxRequest.slots[0].zoneId).to.equal(28313)
      expect(jpxRequest.slots[0].reqId).to.equal('18708daa69a3cd')
      expect(jpxRequest.slots[0].sizes[0]).to.equal(970)
      expect(jpxRequest.slots[0].sizes[1]).to.equal(250)
      expect(jpxRequest.slots[0].lastReq).to.not.equal('undefined')
      expect(jpxRequest.slots[0].cond).to.deep.equal({'allow': ['lb', 'wp']})
      expect(jpxRequest.slots[0].displaying).to.deep.equal([])
    })
  })

  describe('interpretResponse', function () {
    const request = spec.buildRequests(validBidRequests)
    it('Verify server response', function () {
      let response = {
        'bid': [{
          'id': '229ad4743533f3',
          'height': 250,
          'width': 970,
          'price': 0.52,
          'format': 'lb',
          'adm': 'creative code'
        }],
        'pass': {
          '28313': false
        },
        'deals': {}
      }

      let expectedResponse = [{
        requestId: '229ad4743533f3',
        creativeId: '229ad4743533f3',
        width: 970,
        height: 250,
        ad: 'creative code',
        cpm: 0.52,
        netRevenue: true,
        currency: 'USD',
        ttl: 60000,
        format: 'lb'
      }]

      let result = spec.interpretResponse({body: response}, request)
      expect(Object.keys(result[0])).to.deep.equal(Object.keys(expectedResponse[0]))

      expect(result[0]).to.not.equal(null)
      expect(result[0].width).to.equal(970)
      expect(result[0].height).to.equal(250)
      expect(result[0].ad).to.equal('creative code')
      expect(result[0].cpm).to.equal(0.52)
      expect(result[0].currency).to.equal('USD')
      expect(result[0].ttl).to.equal(60000)
      expect(result[0].creativeId).to.equal('229ad4743533f3')
      expect(result[0].netRevenue).to.equal(true)
      expect(result[0].format).to.equal('lb')
    })

    it('Empty server response', function () {
      let response = {
        'bid': [],
        'pass': {
          '28313': true
        }
      }

      let result = spec.interpretResponse({body: response}, request)
      expect(result.length).to.equal(0)
    })
  })

  describe('getUserSyncs', function () {
    it('Verifies sync options', function () {
      const options = spec.getUserSyncs({iframeEnabled: true}, {body: {}, header: {}}, {consentString: 'example_consent', gdprApplies: true})
      expect(options).to.not.be.undefined
      expect(options[0].type).to.equal('iframe')
      expect(options[0].url).to.match(/\/\/pre.ads.justpremium.com\/v\/1.0\/t\/sync/)
    })
  })

  describe('onTimeout', function () {
    it('onTimeout', (done) => {
      spec.onTimeout([{
        'bidId': '25cd3ec3fd6ed7',
        'bidder': 'justpremium',
        'adUnitCode': 'div-1',
        'auctionId': '6fbd0562-f613-4151-a6df-6cb446fc717b',
        'params': [{
          'adType': 'iab',
          'zone': 21521
        }],
        'timeout': 1
      }, {
        'bidId': '3b51df1f254e32',
        'bidder': 'justpremium',
        'adUnitCode': 'div-2',
        'auctionId': '6fbd0562-f613-4151-a6df-6cb446fc717b',
        'params': [{
          'adType': 'iab',
          'zone': 21521
        }],
        'timeout': 1
      }])

      done()
    })
  })
})
