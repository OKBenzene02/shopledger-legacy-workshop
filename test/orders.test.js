const assert = require('node:assert/strict');
const test = require('node:test');
const orders = require('../lib/orders');
const dates = require('../lib/dates');

const db = { orders: [
  { id: 1001, date: '28/12/2021' },
  { id: 1004, date: '30/01/2022' },
  { id: 1008, date: '15/03/2022' }
] };

test('order history sorts newest first across months and years', () => {
  assert.deepEqual(orders.list(db).map((order) => order.id), [1008, 1004, 1001]);
});

test('order date filters include both endpoints across months and accept either input format', () => {
  const rows = orders.list(db, { from: '2022-01-30', to: '2022-03-15' });
  assert.deepEqual(rows.map((order) => order.id), [1008, 1004]);
  assert.deepEqual(orders.list(db, { to: '30/01/2022' }).map((order) => order.id),
    [1004, 1001]);
});

test('fiscal years still start in April for both supported date formats', () => {
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
});
