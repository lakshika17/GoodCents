CREATE TABLE public.developer_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, role text NOT NULL DEFAULT 'admin' CHECK (role = 'admin'), active boolean NOT NULL DEFAULT true);
GRANT SELECT ON public.developer_roles TO authenticated;
GRANT ALL ON public.developer_roles TO service_role;
ALTER TABLE public.developer_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY developer_roles_read_own ON public.developer_roles FOR SELECT TO authenticated USING (active AND lower(email) = lower(auth.jwt()->>'email'));
COMMENT ON TABLE public.developer_roles IS 'Trusted owner-provisioned development authorization only. Grants fictional demo access, never Quantera finance access or employee roles.';