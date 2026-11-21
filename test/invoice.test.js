const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billedOrder(items, coupon = '', id = 1001) {
  // Mirror the order route's handoff to orders.add without loading the store.
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return orders.add({ nextOrderId: id, orders: [] }, {
    date: '21/11/2021', items, coupon, subtotal, discount, tax, total
  });
}

function mixedSlabOrder() {
  return billedOrder([
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 500 },
    { id: 2, name: 'Butter', sku: 'BUTTER', hsn: '0405', qty: 1, price: 1000 }
  ], 'SAVE10');
}

test('invoice total and GST breakdown match a billed mixed-slab order', () => {
  const order = mixedSlabOrder();
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    [figures.subtotal, figures.discount, figures.tax, figures.total],
    [order.subtotal, order.discount, order.tax, order.total]
  );
  assert.deepEqual([figures.cgst, figures.sgst], [78.63, 78.62]);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) =>
    [gstPercent, lineTax]), [[5, 46.25], [12, 111]]);
  assert.deepEqual(figures.rows.map((row) => row.hsn), ['1006', '0405']);
});

test('checkout caps the coupon and applies HSN GST to discounted line values', () => {
  const order = mixedSlabOrder();
  const totals = pricing.computeTotals(order.items, order.coupon);
  assert.deepEqual(
    [order.subtotal, order.discount, order.tax, order.total],
    [2000, 150, 157.25, 2007.25]
  );
  assert.deepEqual(totals.lines.map(({ gstPercent, discount, taxable, tax }) =>
    [gstPercent, discount, taxable, tax]), [
    [5, 75, 925, 46.25],
    [12, 75, 925, 111]
  ]);
  assert.deepEqual([totals.cgst, totals.sgst], [78.63, 78.62]);
});

test('invoice uses the checkout interpretation of explicit GST rates, including zero', () => {
  const items = [5, 0.05, 0].map((gstRate) => ({ price: 100, qty: 1, gstRate }));
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items });
  assert.deepEqual(billed.lines.map((line) => line.tax), [5, 5, 0]);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) =>
    [gstPercent, lineTax]), [[5, 5], [5, 5], [0, 0]]);
});

test('invoice GST total reflects the same rounded line taxes as checkout', () => {
  const order = billedOrder([{ price: 0.03, qty: 1 }, { price: 0.03, qty: 1 }]);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map((row) => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([order.tax, order.total], [0.02, 0.08]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total],
    [0.02, 0.01, 0.01, 0.08]);
});

test('invoice applies no discount for expired coupons or coupons below their minimum', () => {
  const items = [{ price: 100, qty: 1 }];
  for (const coupon of ['DIWALI20', 'FLAT50']) {
    const figures = invoice.computeInvoiceFigures({ items, coupon });
    assert.equal(pricing.computeTotals(items, coupon).discount, 0);
    assert.deepEqual([figures.discount, figures.total], [0, 118], coupon);
  }
});

test('printable invoice displays billed GST and total without a mismatch warning', () => {
  const html = invoice.render(mixedSlabOrder());
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('printable invoice still warns when stored amounts differ from checkout rules', () => {
  const order = { ...mixedSlabOrder(), total: 2000 };
  assert.match(invoice.render(order),
    /Invoice computed total \(₹2007\.25\) differs from Order Ledger recorded total \(₹2000\.00\) by \+₹7\.25/);
});

test('reconciliation reports matching and mismatched orders and skips cancelled orders', () => {
  const matched = billedOrder([{ price: 100, qty: 1 }], '', 1002);
  const cancelled = { ...mixedSlabOrder(), id: 1003, status: 'cancelled' };
  const historical = { ...mixedSlabOrder(), tax: 150, total: 2000 };
  const report = reports.getGstReconciliation({ orders: [historical, matched, cancelled] });
  assert.deepEqual([report.totalChecked, report.mismatchCount, report.totalDelta], [2, 1, 7.25]);
  assert.deepEqual(report.rows.map(({ orderId, ledgerTax, invoiceTax, delta, matched }) =>
    [orderId, ledgerTax, invoiceTax, delta, matched]), [
    [1001, 150, 157.25, 7.25, false],
    [1002, 18, 18, 0, true]
  ]);
});

test('CURRENT BEHAVIOUR: a tax-only mismatch is flagged in reconciliation without an invoice warning', () => {
  const order = { ...billedOrder([{ price: 100, qty: 1 }]), tax: 5 };
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.deepEqual([report.mismatchCount, report.totalDelta], [1, 0]);
  assert.deepEqual([report.rows[0].delta, report.rows[0].matched], [0, false]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
