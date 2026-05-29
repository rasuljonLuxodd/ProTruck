-- Security hardening pass (applied 2026-05-29)
-- Closes two genuine vulnerabilities flagged by the Supabase advisor:
--   1. apply_stocktake / produce_with_bom / receive_purchase_order_items
--      were SECURITY DEFINER and callable by the `anon` role via REST.
--      An unauthenticated attacker holding the (public) publishable key
--      could corrupt inventory. Fixed by revoking EXECUTE from anon/public
--      + adding an explicit auth.uid() guard inside each.
--   2. Those same functions + set_purchase_order_number had a mutable
--      search_path (privilege-escalation vector for DEFINER functions).
--      Fixed with SET search_path = public.
-- Plus: account_balances view switched from the default SECURITY DEFINER
-- to security_invoker so it respects the caller's RLS.
--
-- See the full bodies in the live DB; this file documents the change set.

ALTER FUNCTION public.produce_with_bom(uuid, numeric, timestamptz)  SET search_path = public;
ALTER FUNCTION public.apply_stocktake(jsonb)                         SET search_path = public;
ALTER FUNCTION public.receive_purchase_order_items(uuid, jsonb)      SET search_path = public;
ALTER FUNCTION public.set_purchase_order_number()                    SET search_path = public;

-- Each of the three RPCs was recreated with `IF auth.uid() IS NULL THEN
-- RAISE EXCEPTION 'not_authenticated'; END IF;` as the first statement
-- (bodies otherwise unchanged from their original migrations).

REVOKE EXECUTE ON FUNCTION public.produce_with_bom(uuid, numeric, timestamptz)  FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.apply_stocktake(jsonb)                         FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order_items(uuid, jsonb)      FROM anon, public;

GRANT EXECUTE ON FUNCTION public.produce_with_bom(uuid, numeric, timestamptz)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stocktake(jsonb)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order_items(uuid, jsonb)       TO authenticated;

ALTER VIEW public.account_balances SET (security_invoker = true);
