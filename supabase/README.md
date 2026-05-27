# Supabase

This folder holds Supabase schema migrations under version control.

## Structure

```
supabase/
├── migrations/             # one .sql file per schema change, in apply order
│   └── YYYYMMDDHHMMSS_<name>.sql
└── README.md               # this file
```

## Convention for new migrations

Filename:
```
YYYYMMDDHHMMSS_<short_snake_case_name>.sql
```

Where `YYYYMMDDHHMMSS` is the UTC timestamp at the moment the migration is
applied (matches the `version` column Supabase uses in
`supabase_migrations.schema_migrations`).

When applying a migration via the Supabase MCP, **also** drop a copy here
so the schema is reproducible from git. Existing files are append-only —
don't edit a migration after it's been applied to any environment.

## Historical migrations

The migrations below were applied to the live project before this folder
was set up. They live in Supabase's `supabase_migrations.schema_migrations`
table and can be replayed via `supabase db pull` if you ever need to
bootstrap a new project from scratch.

| Version | Name | What it does |
| ------- | ---- | ------------ |
| 20260526095110 | init_protrack_schema | Profiles, products, sales, debts, expenses, workers, action_logs + RLS |
| 20260526095510 | add_email_to_profiles | Mirror auth.users.email into profiles |
| 20260526095956 | harden_trigger_functions | REVOKE EXECUTE from trigger-only fns |
| 20260526100039 | is_super_admin_invoker | Switch is_super_admin to SECURITY INVOKER |
| 20260526101558 | add_user_id_to_action_logs | Attribute every action to a user |
| 20260526101627 | sell_products_rpc | Atomic sale: stock check + insert + debt + log |
| 20260526101906 | profiles_soft_delete | deleted_at column + filtered RLS |
| 20260526103214 | products_min_stock | Per-product low-water mark |
| 20260526103726 | recurring_expenses | Table + run_recurring_expenses() |
| 20260526110830 | worker_attendance | Table + toggle_worker_attendance() |
| 20260526110958 | refund_sale_rpc | Reverse a sale atomically |
| 20260526111145 | customer_credit_limits | Per-customer max debt |
| 20260526111737 | products_image_url_and_bucket | Image URL + product-images storage bucket |
| 20260526111932 | currency_and_vat | VAT on products, currency on sales/expenses |
| 20260526112217 | suppliers | Supplier table + supplier_id on expenses |
| 20260527013529 | add_product_cost_and_default_price | Cost basis + default price |
| 20260527014109 | add_bom_items_table | Bill of Materials + produce_with_bom RPC |
| 20260527022709 | add_customer_notes | Notes column on customer_credit_limits |
| 20260527023352 | add_stock_adjustments_and_apply_stocktake | Stocktake table + RPC |

## Local development

This project doesn't (yet) use the Supabase CLI locally — migrations are
applied directly to the remote project via MCP. If we move to a CLI
workflow:

```bash
# Once, to initialize the CLI for this project
supabase link --project-ref pltukjsddexaxopuuodp

# To pull the current state into supabase/migrations/
supabase db pull

# To apply local migrations to a new environment
supabase db push
```
