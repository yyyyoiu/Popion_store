# Popion — Cloudflare Free Store

This version is prepared for Cloudflare Workers + D1 on the Free plan.

## Deploy
1. Create a D1 database named `popion-db` in Cloudflare.
2. Copy its database ID into `wrangler.toml` replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
3. Run the schema from `schema.sql` against the D1 database.
4. Change `ADMIN_PASSWORD` in `wrangler.toml` to a strong password.
5. Deploy with Wrangler: `npx wrangler deploy`.

The store has products, cart, order creation, and an admin page at `/admin.html`. Payment is manual for now; a payment provider can be added after deployment.
