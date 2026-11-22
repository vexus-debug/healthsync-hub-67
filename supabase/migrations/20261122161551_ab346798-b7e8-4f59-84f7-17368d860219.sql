ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url text;
CREATE TABLE public.till_closeouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  close_date date NOT NULL DEFAULT current_date,
  expected_cash numeric NOT NULL DEFAULT 0,
  expected_pos numeric NOT NULL DEFAULT 0,
  expected_transfer numeric NOT NULL DEFAULT 0,
  expected_hmo numeric NOT NULL DEFAULT 0,
  cash_expenses numeric NOT NULL DEFAULT 0,
  counted_cash numeric NOT NULL DEFAULT 0,
  variance numeric NOT NULL DEFAULT 0,
  notes text,
  cashier_name text,
  manager_name text,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.till_closeouts TO authenticated;
GRANT ALL ON public.till_closeouts TO service_role;
ALTER TABLE public.till_closeouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view closeouts" ON public.till_closeouts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff record closeouts" ON public.till_closeouts FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins delete closeouts" ON public.till_closeouts FOR DELETE TO authenticated USING (public.is_lab_admin(auth.uid()));
CREATE TRIGGER update_till_closeouts_updated_at BEFORE UPDATE ON public.till_closeouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();