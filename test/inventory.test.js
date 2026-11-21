const assert = require('node:assert/strict');
const test = require('node:test');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('buying the exact sellable quantity leaves wholesale holds intact', () => {
  const products = [
    { id: 6, stock: 1, reserved: 0, sku: 'DRY-001' },
    { id: 11, stock: 4, reserved: 3, sku: 'SPC-001' },
    { id: 12, stock: 8, reserved: 2 }
  ];
  const items = [{ id: 6, qty: 1 }, { id: 11, qty: 1 }, { id: 12, qty: 6 }];
  assert.deepEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);
  assert.deepEqual(products.map(({ stock, reserved }) => [stock, reserved]),
    [[0, 0], [3, 3], [2, 2]]);
});

test('stock checks reject overselling both on one line and across repeated SKUs', () => {
  const product = { id: 11, stock: 4, reserved: 3 };
  assert.equal(inventory.check([product], [{ id: 11, qty: 2 }]).ok, false);
  assert.equal(inventory.check([product], [{ id: 11, qty: 1 }, { id: '11', qty: 1 }]).ok, false);
});

test('cancelling a pending order restores each line exactly once', () => {
  const products = [{ id: 6, stock: 3, reserved: 0 }, { id: 11, stock: 5, reserved: 3 }];
  const items = [{ id: 6, qty: 2 }, { id: 11, qty: 1 }];
  const db = { products, orders: [], nextOrderId: 1007 };
  inventory.reserve(products, items);
  const order = orders.add(db, { items, status: 'pending' });
  assert.deepEqual(products.map((product) => product.stock), [1, 4]);

  const result = orders.cancel(db, 1007);
  assert.equal(result.ok, true);
  assert.equal(order.status, 'cancelled');
  assert.deepEqual(products.map(({ stock, reserved }) => [stock, reserved]), [[3, 0], [5, 3]]);
  assert.equal(orders.cancel(db, 1007).ok, false);
  assert.deepEqual(products.map((product) => product.stock), [3, 5]);
});

test('releasing a wholesale hold reduces reserved stock only', () => {
  const product = { id: 11, stock: 4, reserved: 3 };
  inventory.release([product], [{ productId: 11, qty: 1 }]);
  assert.deepEqual([product.stock, product.reserved], [4, 2]);
});
