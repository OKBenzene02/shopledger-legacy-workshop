# Repository Guidelines

## Stack

ShopLedger uses Node.js, CommonJS, Express 4, and `body-parser`. The browser UI uses plain HTML, CSS, and JavaScript. The app persists data in a local JSON file.

## Module Map

- `server.js` serves the UI, mounts the `/api` routers, and handles the printable invoice route.
- `routes/` contains the products, orders, customers, and reports routers.
- `lib/` contains order, inventory, pricing, tax, coupon, Khata ledger, date, invoice, and reporting logic. `lib/store.js` reads and writes `data/db.json`.
- `public/` holds the browser UI and assets. `config.js` holds application settings and business configuration.

## Commands

- `npm install` installs the declared dependencies.
- `npm start` runs `node server.js` on port 3000 by default. Set `PORT` to override it.
- `node --check lib/pricing.js` checks JavaScript syntax. Substitute the file you changed.
- `npm test` is a placeholder that exits with an error. There is no configured test runner.

## Rules

- Write and run characterization tests that capture the current behavior before changing it.
- Limit production code changes to the module named in the ticket.
- Tests must never read or write `data/db.json`, including indirectly through the application. Use in-memory fixtures or isolated temporary data.
- Add no runtime or development dependencies.
- Trace the affected flow before proposing or implementing a fix. For example, follow order placement from the browser or API through the router and relevant `lib/` functions to the persistence boundary.
- Prefer the simplest fix that addresses the cause and preserves unrelated behavior.
- Preserve the repository layout and existing module boundaries. Leave unrelated code and files alone.
- Reuse existing functions where practical. Extract shared logic into a focused, descriptively named function in the ticket's module when it needs to serve multiple callers.
- Give each new file one clear responsibility and follow the naming conventions of its directory. Use short, lowercase, purpose-based names for source modules, such as `pricing.js` or `inventory.js`.
- Apply SOLID principles when a design change benefits from clearer responsibilities or dependencies. Keep small bug fixes local and avoid adding abstractions they do not need.
