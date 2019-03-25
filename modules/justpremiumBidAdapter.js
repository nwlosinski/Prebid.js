import { registerBidder } from 'src/adapters/bidderFactory'
import { getTopWindowLocation } from 'src/utils'

const BIDDER_CODE = 'justpremium'
const ENDPOINT_URL = '//pre.ads.justpremium.com/v/2.1/t/xhr'
const JP_ADAPTER_VERSION = '1.4'
const pixels = []
const TRACK_START_TIME = Date.now()
let LAST_PAYLOAD = {}
let AD_UNIT_IDS = []
let LAST_REQUEST_TIME = {}

export const spec = {
  code: BIDDER_CODE,
  time: 60000,

  isBidRequestValid: (bid) => {
    return !!(bid && bid.params && bid.params.zone)
  },

  buildRequests: (validBidRequests, bidderRequest) => {
    let dim = getWebsiteDim()
    let displaying = getCurrentlyDisplayedAd().map(displayed => {
      displayed.timeInSec = (+new Date() - displayed.time) / 1000
      return displayed
    })

    let slots = validBidRequests.map(bid => {
      const {bidId, adUnitCode, bidderRequestId, bidRequestsCount, mediaTypes, params} = bid
      let lastReq = LAST_REQUEST_TIME[adUnitCode] ? (+new Date() - LAST_REQUEST_TIME[adUnitCode]) : 0
      LAST_REQUEST_TIME[adUnitCode] = +new Date()
      if (AD_UNIT_IDS.indexOf(adUnitCode) === -1) {
        AD_UNIT_IDS.push(adUnitCode)
      }
      return {
        id: bidId,
        code: adUnitCode,
        reqId: bidderRequestId,
        count: bidRequestsCount,
        type: 'banner',
        sizes: mediaTypes.banner && mediaTypes.banner.sizes,
        cond: preparePubCond(params),
        zoneId: params.zone,
        lastReq: lastReq,
        displaying: displaying
      }
    })

    let payload = {
      hostname: getTopWindowLocation().hostname,
      protocol: getTopWindowLocation().protocol.replace(':', ''),
      sw: dim.screenWidth,
      sh: dim.screenHeight,
      ww: dim.innerWidth,
      wh: dim.innerHeight,
      slots: slots,
      sizes: {}
    }
    validBidRequests.forEach(b => {
      const zone = b.params.zone
      const sizes = payload.sizes
      sizes[zone] = sizes[zone] || []
      sizes[zone].push.apply(sizes[zone], b.sizes)
    })

    if (bidderRequest && bidderRequest.gdprConsent) {
      payload.gdpr_consent = {
        consent_string: bidderRequest.gdprConsent.consentString,
        consent_required: (typeof bidderRequest.gdprConsent.gdprApplies === 'boolean') ? bidderRequest.gdprConsent.gdprApplies : true
      }
    }

    payload.version = {
      prebid: '$prebid.version$',
      jp_adapter: JP_ADAPTER_VERSION
    }

    const payloadString = JSON.stringify(payload)

    LAST_PAYLOAD = payload

    return {
      method: 'POST',
      url: ENDPOINT_URL + '?i=' + (+new Date()),
      data: payloadString,
      bids: validBidRequests
    }
  },

  interpretResponse: (serverResponse, bidRequests) => {
    const bids = serverResponse.body.bid
    let bidResponses = []
    bidRequests.bids.forEach(request => {
      let bid = findBid(request, bids)
      if (bid) {
        let size = request.sizes && request.sizes.length && (request.sizes[0] || [])
        let bidResponse = {
          requestId: request.bidId,
          creativeId: bid.id,
          width: size[0] || bid.width,
          height: size[1] || bid.height,
          ad: bid.adm,
          cpm: bid.price,
          netRevenue: true,
          currency: bid.currency || 'USD',
          ttl: bid.ttl || spec.time,
          format: bid.format
        }
        bidResponses.push(bidResponse)
      }
    })

    return bidResponses
  },

  getUserSyncs: function getUserSyncs(syncOptions, responses, gdprConsent) {
    let url = '//pre.ads.justpremium.com/v/1.0/t/sync'
    if (gdprConsent && (typeof gdprConsent.gdprApplies === 'boolean')) {
      url = url + '?consentString=' + encodeURIComponent(gdprConsent.consentString)
    }
    if (syncOptions.iframeEnabled) {
      pixels.push({
        type: 'iframe',
        url: url
      })
    }
    return pixels
  },

  onTimeout: (timeoutData) => {
    timeoutData.forEach((data) => {
      if (AD_UNIT_IDS.indexOf(data.adUnitCode) != -1) {
        track(data, LAST_PAYLOAD, 'btm')
      }
    })
  },

}

function getCurrentlyDisplayedAd() {
  let top
  try {
    top = window.top
  } catch (e) {
    top = window
  }

  let displayed = []

  try {
    displayed = top.jPAM.getPlugin('bidder').getDisplayedAds()
  } catch (e) {}

  return displayed
}

function track (data, payload, type) {
  let pubUrl = ''

  let jp = {
    auc: data.adUnitCode,
    to: data.timeout
  }

  if (window.top == window) {
    pubUrl = window.location.href
  } else {
    try {
      pubUrl = window.top.location.href
    } catch (e) {
      pubUrl = document.referrer
    }
  }

  let duration = Date.now() - TRACK_START_TIME

  const pixelUrl = `//emea-v3.tracking.justpremium.com/tracking.gif?rid=&sid=&uid=&vr=&
ru=${encodeURIComponent(pubUrl)}&tt=&siw=&sh=${payload.sh}&sw=${payload.sw}&wh=${payload.wh}&ww=${payload.ww}&an=&vn=&
sd=&_c=&et=&aid=&said=&ei=&fc=&sp=&at=bidder&cid=&ist=&mg=&dl=&dlt=&ev=&vt=&zid=${payload.id}&dr=${duration}&di=&pr=&
cw=&ch=&nt=&st=&jp=${encodeURIComponent(JSON.stringify(jp))}&ty=${type}`

  let img = document.createElement('img')
  img.src = pixelUrl
  img.id = 'jp-pixel-track'
  img.style.cssText = 'display:none !important;'
  document.body.appendChild(img)
}

function findBid(request, bids) {
  let chooseBid = false
  bids.forEach(function (bid) {
    if (request.bidId === bid.id) {
      chooseBid = bid
    }
  });
  return chooseBid
}

function preparePubCond(params) {
  if (params.exclude && !params.allow) {
    return {
      exclude: params.exclude
    }
  }

  if (params.allow) {
    return {
      allow: params.allow
    }
  }

  return {}
}

function getWebsiteDim () {
  let top
  try {
    top = window.top
  } catch (e) {
    top = window
  }

  return {
    screenWidth: top.screen.width,
    screenHeight: top.screen.height,
    innerWidth: top.innerWidth,
    innerHeight: top.innerHeight
  }
}

registerBidder(spec)
