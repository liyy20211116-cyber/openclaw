import assert from 'node:assert/strict'
import {
  confirmPayment,
  createPaymentPendingFromSalesLead,
  createQuotedRevenueFromSalesLead,
  getRevenueSummary,
  isConfirmedCash,
  isRecognizedRevenue,
  listRevenueRecords,
  recognizeRevenue,
  resetRevenueConfirmationMockStateForTest,
} from '../src/services/revenueConfirmationService'

resetRevenueConfirmationMockStateForTest()

const records = listRevenueRecords()
assert.equal(records.length, 5)

const summary = getRevenueSummary()
assert.equal(summary.expectedRevenue, 21_799)
assert.equal(summary.paymentPending, 1_999)
assert.equal(summary.confirmedCash, 1_999)
assert.equal(summary.recognizedRevenue, 999)
assert.equal(summary.refunded, 0)
assert.equal(summary.requiresCeoApprovalCount, 2)

assert.equal(isConfirmedCash({ status: 'payment_confirmed' }), true)
assert.equal(isConfirmedCash({ status: 'delivery_started' }), true)
assert.equal(isConfirmedCash({ status: 'delivered' }), true)
assert.equal(isConfirmedCash({ status: 'payment_pending' }), false)

assert.equal(isRecognizedRevenue({ status: 'recognized' }), true)
assert.equal(isRecognizedRevenue({ status: 'payment_confirmed' }), false)
assert.equal(isRecognizedRevenue({ status: 'refunded' }), false)

const quoted = createQuotedRevenueFromSalesLead('lead_quote_review_002')
assert.equal(quoted.record.status, 'quoted')
assert.equal(quoted.record.amount, 19_800)
assert.equal(quoted.created, false, 'seed already contains quoted record for this lead')

const pending = createPaymentPendingFromSalesLead('lead_payment_pending_003')
assert.equal(pending.record.status, 'payment_pending')
assert.equal(pending.record.amount, 1_999)
assert.equal(pending.created, false, 'seed already contains payment pending record for this lead')

const cashRequest = confirmPayment('rev_payment_pending_003', 'ceo')
assert.equal(cashRequest.record.status, 'payment_confirmed')
assert.equal(cashRequest.record.requiresCeoApproval, true)
assert.match(cashRequest.message, /CEO/)

const recognitionRequest = recognizeRevenue('rev_payment_confirmed_004', 'ceo')
assert.equal(recognitionRequest.record.status, 'recognized')
assert.equal(recognitionRequest.record.requiresCeoApproval, true)
assert.match(recognitionRequest.message, /CEO/)

console.log('revenue confirmation service tests passed')
