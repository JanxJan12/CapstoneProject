import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { customerTimelineSteps, customerTimelineStepState } from '../src/modules/customer/customerOrderSteps.ts';

test('completed takeout uses Completed, never Delivered or Rider milestones', () => {
  const steps = customerTimelineSteps('takeout', 'completed');
  assert.deepEqual(steps.map((step) => step.status), [
    'waiting_payment_verification', 'confirmed', 'preparing', 'ready', 'completed',
  ]);
  assert.deepEqual(customerTimelineStepState('completed', 'completed', false), {
    isCurrent: true, isComplete: true,
  });
});

test('delivery is Delivered only from the authoritative delivered status', () => {
  const delivered = customerTimelineSteps('delivery', 'delivered');
  assert.equal(delivered.at(-1)?.status, 'delivered');
  assert.deepEqual(customerTimelineStepState('delivered', 'delivered', false), {
    isCurrent: true, isComplete: true,
  });
  const completed = customerTimelineSteps('delivery', 'completed');
  assert.equal(completed.at(-1)?.status, 'completed');
  assert.equal(completed.some((step) => step.status === 'delivered'), false);
});

test('in-progress takeout and dine-in do not show Rider steps as achieved', () => {
  for (const type of ['takeout', 'dine_in']) {
    const steps = customerTimelineSteps(type, 'ready');
    assert.equal(steps.some((step) => step.status === 'delivered' || step.status === 'picked_up'), false);
    assert.deepEqual(customerTimelineStepState('ready', 'completed', false), {
      isCurrent: false, isComplete: false,
    });
  }
});

test('cancelled and pending payment cannot complete a fulfillment milestone', () => {
  for (const status of ['cancelled', 'waiting_payment_verification']) {
    for (const type of ['takeout', 'delivery']) {
      const terminal = customerTimelineSteps(type, status).at(-1);
      assert.equal(customerTimelineStepState(status, terminal.status, false).isComplete, false);
    }
  }
});

test('mounted tracker consumes the service-aware timeline, not the old completion shortcut', async () => {
  const source = await readFile('src/modules/customer/customerTrackingPage.tsx', 'utf8');
  assert.match(source, /customerTimelineSteps\(order\.fulfillment_type, order\.current_status\)/);
  assert.match(source, /customerTimelineStepState\(\s*order\.current_status, trackingStep\.status/);
  assert.doesNotMatch(source, /\(isCompleted \|\| isDelivered\) &&\s*trackingStep\.status ===\s*"delivered"/);
});
