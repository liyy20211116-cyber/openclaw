import catalog from '../../../config/offer-catalog.json'
import type { Offer, OfferMatch, Opportunity } from '../types'

type OfferCatalogFile = {
  offers: Offer[]
}

const offerCatalog = catalog as OfferCatalogFile
const DEFAULT_OFFER_ID = 'ai_automation_diagnosis'

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, '')
}

function isWeakToken(token: string) {
  return ['ai', 'agent', 'mvp', 'os'].includes(token.toLowerCase())
}

function overlapScore(text: string, tags: string[]) {
  const normalizedText = normalize(text)
  return tags.reduce((score, tag) => {
    const normalizedTag = normalize(tag)
    if (!normalizedTag) return score
    if (normalizedText.includes(normalizedTag)) return score + 4

    const tagParts = tag
      .toLowerCase()
      .split(/[\s、，,]+/)
      .map(part => part.trim())
      .filter(part => part.length >= 2 && !isWeakToken(part))
    const partHits = tagParts.filter(part => normalizedText.includes(normalize(part))).length
    return score + partHits
  }, 0)
}

function buildMatch(offer: Offer, matchReason: string, score: number): OfferMatch {
  return { offer, matchReason, score }
}

export function listOffers(): Offer[] {
  return [...offerCatalog.offers]
}

export function getOfferById(id: string): Offer | undefined {
  return offerCatalog.offers.find(offer => offer.id === id)
}

export function matchOfferByPainPoint(painPoint: string): OfferMatch {
  const offers = listOffers()
  const matches = offers
    .map(offer => ({ offer, score: overlapScore(painPoint, offer.painPointTags) }))
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score || a.offer.price - b.offer.price)

  if (matches[0]) {
    return buildMatch(
      matches[0].offer,
      `痛点与产品标签匹配：${matches[0].offer.painPointTags.join('、')}`,
      matches[0].score,
    )
  }

  const fallback = getOfferById(DEFAULT_OFFER_ID) ?? offers[0]
  return buildMatch(fallback, '未命中明确标签，默认推荐企业 AI 自动化诊断报告作为低风险诊断入口', 0)
}

function matchSuggestedOfferText(suggestedOffer: string): Offer | undefined {
  const text = normalize(suggestedOffer)
  if (!text) return undefined

  return listOffers().find(offer => {
    const name = normalize(offer.name)
    const id = normalize(offer.id)
    return text.includes(name) || text.includes(id) || name.includes(text)
  })
}

export function matchOfferByOpportunity(opportunity: Opportunity): OfferMatch {
  const suggestedOffer = matchSuggestedOfferText(opportunity.suggestedOffer)
  if (suggestedOffer) {
    return buildMatch(suggestedOffer, `已将机会中的 suggestedOffer 映射到标准产品：${suggestedOffer.name}`, 10)
  }

  if (opportunity.estimatedBudget >= 45000) {
    const offer = getOfferById('private_one_company_os')
    if (offer) return buildMatch(offer, '机会预算较高，优先推荐私有化一人公司 OS', 12)
  }

  if (opportunity.estimatedBudget >= 15000) {
    const offer = getOfferById('enterprise_automation_mvp')
    if (offer) return buildMatch(offer, '机会预算较高，优先推荐企业流程自动化 MVP', 10)
  }

  return matchOfferByPainPoint(`${opportunity.title} ${opportunity.painPoint} ${opportunity.contactHint}`)
}

export const offerCatalogService = {
  listOffers,
  getOfferById,
  matchOfferByPainPoint,
  matchOfferByOpportunity,
}
