# ShopLedger codebase walkthrough

## 1. Tech stack

| Layer | What the repo uses |
| --- | --- |
| Backend | Node.js and Express 4 (`^4.17.1` in the package manifest). Server modules use CommonJS (`require` and `module.exports`). |
| Frontend | Plain HTML, CSS, and JavaScript. The browser calls the server using `XMLHttpRequest`. |
| API | HTTP routes under `/api` return JSON. The `body-parser` package parses JSON request bodies. Invoices are printable HTML. |
| Storage | A single local file, `data/db.json`. Node's `fs` module reads and rewrites it synchronously. |
| Startup and tests | `npm start` runs `node server.js`. The default port is `3000`, configurable through `PORT`. The `npm test` script is a placeholder that exits with an error. |

[Package manifest](package.json) · [Server entry point](server.js) · [Configuration](config.js)

## 2. What the project does

**ShopLedger is an internal billing, inventory, and customer-credit app for a kirana and wholesale shop.** A counter operator can enter a sale, calculate discounts and GST, update stock, and keep track of what customers owe.

**Khata** is a running credit account. If a customer buys ₹500 on Khata and later pays ₹200, the shop records that payment as a **settlement**. Assuming they started at zero, the customer should now owe ₹300. The app checks the customer's configured credit limit when placing a Khata order.

| Screen | What staff do there |
| --- | --- |
| **New Order** | Find products, select quantities, try a coupon, preview GST and the total, and record a cash, UPI, or Khata sale. |
| **Order Register** | Search and filter orders, open a printable invoice, and cancel orders. |
| **Customer Khata** | See credit limits and balances, record a payment, and review recent settlements. |
| **Inventory & GST Audit** | See physical, reserved, and sellable stock. Compare saved order amounts with the invoice calculation. |

[Browser screens](public/index.html)

## 3. Follow one sale through the code

1. **Pick products.** The browser keeps the cart in memory and sends it to `POST /api/pricing/preview`. The server looks up catalog prices and calculates the coupon discount, GST, and total. [Browser cart](public/js/app.js) · [Preview route](routes/reports.js)
2. **Place the order.** `POST /api/orders` looks up products again, checks sellable stock, validates the coupon, and recalculates the total. For a Khata sale, it checks the account's credit limit and adds the charge to the customer's balance. [Order route](routes/orders.js) · [Customer ledger](lib/ledger.js)
3. **Save the sale.** The order route deducts physical stock, saves the line items and totals, adds an audit entry, and writes the database file. The same file holds products, orders, customers, settlements, audit entries, and ID counters. [Inventory](lib/inventory.js) · [Order records](lib/orders.js) · [Storage](lib/store.js)
4. **Open the invoice.** `GET /orders/:id/invoice` loads the saved order, calculates the figures again, and renders printable HTML. GST reconciliation compares that calculation with the stored sale. [Invoice route](server.js) · [Invoice calculation](lib/invoice.js) · [Reconciliation](lib/reports.js)

## 4. Where to look first

| If you're working on… | Start here |
| --- | --- |
| A button, form, or visible field | [public/index.html](public/index.html) and [public/js/app.js](public/js/app.js) |
| Which route handles a request | [server.js](server.js) and the relevant file in [routes/](routes/) |
| Stock availability or cancellation | [lib/inventory.js](lib/inventory.js) and [lib/orders.js](lib/orders.js) |
| Cart totals, GST rates, or coupons | [lib/pricing.js](lib/pricing.js), [lib/tax.js](lib/tax.js), and [lib/coupons.js](lib/coupons.js) |
| Customer credit or recorded payments | [lib/ledger.js](lib/ledger.js) and [routes/customers.js](routes/customers.js) |
| An invoice mismatch or dashboard figure | [lib/invoice.js](lib/invoice.js) and [lib/reports.js](lib/reports.js) |
| Date filters or order sorting | [lib/dates.js](lib/dates.js) and [lib/orders.js](lib/orders.js) |

## 5. I am sure

These findings come from reading the source and running checks against in-memory examples or the bundled data.

| Confirmed behavior | What I checked | Files |
| --- | --- | --- |
| **Khata settlements can inflate the amount recorded as paid.** | The browser sends the amount as text. Adding the string `"50"` to a prior settled total of `100` produced `"10050"` instead of `150`. The balance calculation then uses that inflated number. | [Browser input](public/js/app.js) · [Ledger](lib/ledger.js) |
| **Cancelling a newly created order fails to restore physical stock.** | Checkout deducts `stock` and saves each item with an `id`. Cancellation calls a release function that looks for `productId` and adjusts `reserved` when it finds a match. In a check with six units, selling two took stock to four and the release left it at four. | [Order route](routes/orders.js) · [Cancellation](lib/orders.js) · [Inventory](lib/inventory.js) |
| **Checkout and invoices can show different amounts.** | Checkout applies product-specific GST after allocating the coupon discount. The invoice recalculates and uses a default tax rate when the item lacks `gstRate`. The bundled data had **7 mismatches out of 8 orders checked**. | [Checkout pricing](lib/pricing.js) · [Invoice](lib/invoice.js) · [Reconciliation](lib/reports.js) |
| **Date sorting and range filters can give incorrect results.** | Sorting newest first put `31/01/2021` ahead of `01/02/2021`. Both sorting and filtering compare day-first date strings, which can give incorrect results across months or years. | [Order queries](lib/orders.js) · [Date helpers](lib/dates.js) |

## 6. I suspect

- **The stock check may be holding back one extra unit.** I verified that a request for five units is rejected when exactly five are sellable. A source comment mentions a safety buffer. Check whether the shop wants to keep an extra unit after reserved stock is already accounted for. [Stock check](lib/inventory.js)
- **The dashboard may count revenue earlier than staff expect.** Pending orders contribute to gross revenue, and the UI calls them “Pending Dispatch.” Whether that is correct depends on when the shop counts the sale. [Dashboard calculation](lib/reports.js) · [Order status options](public/index.html)
- **Saved order totals are likely the right starting point for aligning invoices.** Checkout stores what it charged, and Khata uses that same total. Historical records may lack the per-line tax and discount details needed to reproduce a complete invoice breakdown. [Saved orders](lib/orders.js) · [Checkout](routes/orders.js) · [Invoice calculation](lib/invoice.js)

**First bug to tackle** · Start with `recordSettlement` in [lib/ledger.js](lib/ledger.js). You can trace a single input from the payment form to the stored total, and the result directly affects what a customer appears to owe.
