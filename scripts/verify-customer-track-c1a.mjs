import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  customerPaymentSubmissionIsCurrent,
  customerPaymentTrackingState,
} from '../src/modules/customer/customerPaymentTrackingState.ts';

test('waiting order without payment exposes the existing inline submission state', () => {
  assert.deepEqual(customerPaymentTrackingState('waiting_payment_verification', null, true), {
    notSubmitted: true,
    needsResubmission: false,
    showPendingNotice: false,
    statusLabel: 'Not submitted',
  });
  assert.equal(customerPaymentTrackingState('waiting_payment_verification', null, false).notSubmitted, false);
  assert.equal(customerPaymentTrackingState('cancelled', null, true).notSubmitted, false);
  assert.equal(customerPaymentTrackingState('waiting_payment_verification', 'pending', true).notSubmitted, false);
});

test('pending notice follows the current order and payment states', () => {
  for (const status of ['verified', 'rejected', 'voided']) {
    assert.equal(customerPaymentTrackingState('waiting_payment_verification', status, true).showPendingNotice, false);
  }
  assert.equal(customerPaymentTrackingState('waiting_payment_verification', 'pending', true).showPendingNotice, true);
  assert.equal(customerPaymentTrackingState('cancelled', 'pending', true).showPendingNotice, false);
});

test('cancellation takes precedence over rejected payment instructions', () => {
  const cancelled = customerPaymentTrackingState('cancelled', 'rejected', true);
  assert.equal(cancelled.statusLabel, 'Rejected before cancellation');
  assert.equal(cancelled.needsResubmission, false);
  assert.equal(customerPaymentTrackingState('waiting_payment_verification', 'rejected', true).needsResubmission, true);
});

test('submission recheck uses the same order, total and payment state', () => {
  const viewed = { id: 'order-a', grand_total: '250.00' };
  const current = { ...viewed, current_status: 'waiting_payment_verification' };
  assert.equal(customerPaymentSubmissionIsCurrent(viewed, null, current, null), true);
  assert.equal(customerPaymentSubmissionIsCurrent(viewed, null, current, { payment_id: 'payment-a', payment_status: 'pending' }), false);
  assert.equal(customerPaymentSubmissionIsCurrent(viewed, null, { ...current, current_status: 'cancelled' }, null), false);
  assert.equal(customerPaymentSubmissionIsCurrent(viewed, null, { ...current, grand_total: '300.00' }, null), false);
  assert.equal(customerPaymentSubmissionIsCurrent(viewed, null, { ...current, id: 'order-b' }, null), false);
  assert.equal(customerPaymentSubmissionIsCurrent(viewed, { payment_id: 'payment-a' }, current, { payment_id: 'payment-a', payment_status: 'rejected' }), true);
  assert.equal(customerPaymentSubmissionIsCurrent(viewed, { payment_id: 'payment-a' }, current, { payment_id: 'payment-b', payment_status: 'rejected' }), false);
  assert.equal(customerPaymentSubmissionIsCurrent(viewed, { payment_id: 'payment-a' }, current, { payment_id: 'payment-a', payment_status: 'pending' }), false);
});
