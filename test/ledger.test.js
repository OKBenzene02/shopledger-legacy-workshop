const assert = require('node:assert/strict');
const test = require('node:test');
const ledger = require('../lib/ledger');

function customerLedger() {
  return {
    customers: [{ id: 1, name: 'Meera Joshi', totalBilled: 2432.01, totalSettled: 1200 }],
    nextSettlementId: 1
  };
}

test('a payment string increases the settled total and reduces the balance', () => {
  const db = customerLedger();
  assert.equal(ledger.listCustomers(db)[0].balance, 1232.01);
  const result = ledger.recordSettlement(db, 1, '500');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});

test('settlements support existing numeric strings and decimal payments', () => {
  const db = customerLedger();
  db.customers[0].totalSettled = '1200.10';
  const result = ledger.recordSettlement(db, 1, 0.2);
  assert.equal(result.customer.totalSettled, 1200.3);
  assert.equal(result.customer.balance, 1231.71);
});

test('invalid amounts do not change the ledger or consume a settlement ID', () => {
  const db = customerLedger();
  for (const amount of ['abc', 'Infinity', Infinity, 0, '-1', '', true, [500]]) {
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
  }
  assert.deepEqual(db, customerLedger());
});
