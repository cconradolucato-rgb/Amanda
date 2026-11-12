-- Adiciona o administrador autorizado e habilita sua aprovação no primeiro acesso.
-- Não confirma contas automaticamente nem altera processos ou senhas.
BEGIN;
CREATE OR REPLACE FUNCTION public.office_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(auth.jwt()->>'role','')='service_role' OR (auth.uid() IS NOT NULL AND lower(coalesce(auth.jwt()->>'email','')) IN ('assistente2@dibbernadvogados.com.br','carina@dibbernadvogados.com.br','danilo@dibbernadvogados.com.br','cconradolucato@gmail.com'))
$$;
DO $$ BEGIN
 IF to_regprocedure('public.office_admin()') IS NULL OR to_regclass('office_private.dashboards') IS NULL THEN
  RAISE EXCEPTION 'Ative primeiro a migração de permissões por advogado.';
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS office_private.account_approvals(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL,
 email text NOT NULL,
 approved_by uuid NOT NULL,
 approved_by_email text NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE office_private.account_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON office_private.account_approvals FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.office_staff_accounts() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE output jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.office_admin() OR NOT EXISTS(SELECT 1 FROM auth.users actor WHERE actor.id=auth.uid() AND lower(actor.email)=lower(auth.jwt()->>'email') AND actor.email_confirmed_at IS NOT NULL AND actor.deleted_at IS NULL AND (actor.banned_until IS NULL OR actor.banned_until<=now())) THEN
  RAISE EXCEPTION 'Somente Amanda, Carina ou Danilo podem consultar os cadastros.' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
 'id',u.id,'email',u.email,'name',u.raw_user_meta_data->'dibbern_profile'->>'name',
 'oab',u.raw_user_meta_data->'dibbern_profile'->>'oab','phone',u.raw_user_meta_data->'dibbern_profile'->>'phone',
 'photo',CASE WHEN length(u.raw_user_meta_data->'dibbern_profile'->>'photo')<=2400 THEN u.raw_user_meta_data->'dibbern_profile'->>'photo' ELSE NULL END,
 'createdAt',u.created_at,'confirmedAt',u.email_confirmed_at,
 'blocked',coalesce(u.banned_until>now(),false),
 'lastApprovedAt',(SELECT max(a.approved_at) FROM office_private.account_approvals a WHERE a.user_id=u.id)
 ) ORDER BY (u.email_confirmed_at IS NOT NULL),lower(u.email)),'[]') INTO output
 FROM auth.users u
 WHERE u.deleted_at IS NULL AND lower(u.email) IN (
 'cconradolucato@gmail.com','assistente1@dibbernadvogados.com.br','assistente2@dibbernadvogados.com.br',
 'assistente3@dibbernadvogados.com.br','assistente9@dibbernadvogados.com.br',
 'assistente10@dibbernadvogados.com.br','assistente6@dibbernadvogados.com.br',
 'carina@dibbernadvogados.com.br','danilo@dibbernadvogados.com.br');
 RETURN output;
END $$;
CREATE OR REPLACE FUNCTION public.office_approve_account(p_user_id uuid,p_email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target auth.users%ROWTYPE; activated timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT public.office_admin() OR NOT EXISTS(SELECT 1 FROM auth.users actor WHERE actor.id=auth.uid() AND lower(actor.email)=lower(auth.jwt()->>'email') AND actor.email_confirmed_at IS NOT NULL AND actor.deleted_at IS NULL AND (actor.banned_until IS NULL OR actor.banned_until<=now())) THEN
  RAISE EXCEPTION 'Somente Amanda, Carina ou Danilo podem aprovar cadastros.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO target FROM auth.users WHERE id=p_user_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR lower(target.email) IS DISTINCT FROM lower(trim(p_email)) OR lower(target.email) NOT IN (
 'cconradolucato@gmail.com','assistente1@dibbernadvogados.com.br','assistente2@dibbernadvogados.com.br',
 'assistente3@dibbernadvogados.com.br','assistente9@dibbernadvogados.com.br',
 'assistente10@dibbernadvogados.com.br','assistente6@dibbernadvogados.com.br',
 'carina@dibbernadvogados.com.br','danilo@dibbernadvogados.com.br') THEN
  RAISE EXCEPTION 'Cadastro não encontrado ou e-mail não autorizado.' USING ERRCODE='42501';
 END IF;
 IF target.banned_until>now() THEN RAISE EXCEPTION 'Esta conta está suspensa. A aprovação não remove a suspensão.' USING ERRCODE='42501'; END IF;
 IF target.email_confirmed_at IS NOT NULL THEN RETURN jsonb_build_object('email',target.email,'confirmedAt',target.email_confirmed_at,'alreadyConfirmed',true); END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.identities WHERE user_id=target.id AND provider='email') THEN
  RAISE EXCEPTION 'O cadastro por e-mail precisa ser conferido no Supabase.' USING ERRCODE='42501';
 END IF;
 activated:=now();
 UPDATE auth.users SET email_confirmed_at=activated,confirmation_token='',updated_at=activated WHERE id=target.id;
 UPDATE auth.identities SET identity_data=coalesce(identity_data,'{}')||jsonb_build_object('email_verified',true) WHERE user_id=target.id AND provider='email';
 INSERT INTO office_private.account_approvals(user_id,email,approved_by,approved_by_email,approved_at)
 VALUES(target.id,target.email,auth.uid(),auth.jwt()->>'email',activated);
 RETURN jsonb_build_object('email',target.email,'confirmedAt',activated,'alreadyConfirmed',false);
END $$;
REVOKE ALL ON FUNCTION public.office_staff_accounts(),public.office_approve_account(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_staff_accounts(),public.office_approve_account(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.office_account_activation_version() RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.office_account_activation_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.office_account_activation_version() TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'Administrador cconradolucato@gmail.com autorizado para primeiro acesso' AS status;
