-- Dibbern: executar como proprietário do banco no SQL Editor do Supabase.
-- Preserva a linha original e cria uma cópia privada antes da alteração.
-- Executar somente junto da versão do site que suporta officeAccess.version = 1.
BEGIN;
CREATE SCHEMA IF NOT EXISTS office_private;
REVOKE ALL ON SCHEMA office_private FROM PUBLIC, anon, authenticated;
DO $migration$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='dashboards' AND c.relkind='r') THEN
  CREATE TABLE IF NOT EXISTS office_private.dashboard_backup_20261111 AS TABLE public.dashboards;
  ALTER TABLE public.dashboards SET SCHEMA office_private;
 ELSIF to_regclass('office_private.dashboards') IS NULL THEN
  RAISE EXCEPTION 'Tabela dashboards não encontrada. Nenhum dado foi alterado.';
 END IF;
END $migration$;
REVOKE ALL ON office_private.dashboards FROM PUBLIC, anon, authenticated;
REVOKE ALL ON office_private.dashboard_backup_20261111 FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA office_private TO service_role;
GRANT SELECT, UPDATE ON office_private.dashboards TO service_role;

CREATE TABLE IF NOT EXISTS office_private.court_cache(id integer PRIMARY KEY CHECK(id=1),version text NOT NULL,data jsonb NOT NULL);
REVOKE ALL ON office_private.court_cache FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.office_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(auth.jwt()->>'role','')='service_role' OR (auth.uid() IS NOT NULL AND lower(coalesce(auth.jwt()->>'email','')) IN ('assistente2@dibbernadvogados.com.br','carina@dibbernadvogados.com.br','danilo@dibbernadvogados.com.br'))
$$;
CREATE OR REPLACE FUNCTION public.office_lawyer() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE CASE lower(auth.jwt()->>'email')
 WHEN 'assistente1@dibbernadvogados.com.br' THEN 'paola alves'
 WHEN 'assistente3@dibbernadvogados.com.br' THEN 'lais cavinato'
 WHEN 'assistente9@dibbernadvogados.com.br' THEN 'thais dias'
 WHEN 'assistente10@dibbernadvogados.com.br' THEN 'gabriela pizani'
 WHEN 'assistente6@dibbernadvogados.com.br' THEN 'guilherme aguiar'
 ELSE NULL END END
$$;
CREATE OR REPLACE FUNCTION public.office_normalize(value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT trim(regexp_replace(translate(lower(coalesce(value,'')),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^a-z0-9]+',' ','g'))
$$;
CREATE OR REPLACE FUNCTION public.office_owner(value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT regexp_replace(public.office_normalize(value),'^(dr|dra) +','')
$$;
CREATE OR REPLACE FUNCTION public.office_has_owner(value jsonb, lawyer text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements_text(CASE jsonb_typeof(value) WHEN 'array' THEN value WHEN 'string' THEN to_jsonb(string_to_array(value #>> '{}',' / ')) ELSE '[]'::jsonb END) x WHERE public.office_owner(x)=lawyer)
$$;
CREATE OR REPLACE FUNCTION public.office_case_ids(doc jsonb) RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE own text:=public.office_lawyer(); b jsonb; a jsonb; d jsonb; p jsonb; client text; texts text; ids text[]:='{}'; owns boolean;
BEGIN
 IF own IS NULL THEN RETURN ids; END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(coalesce(doc->'base','[]')) LOOP
  a:=coalesce(doc->'annotations'->(b->>'id'),'{}');
  owns:=public.office_has_owner(a->'owners',own) OR public.office_has_owner(a->'owner',own) OR public.office_has_owner(a->'portfolioOwners',own);
  IF NOT owns THEN
   SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(doc->'deadlines','[]')) x WHERE x->>'caseId'=b->>'id' AND public.office_has_owner(x->'owner',own)) INTO owns;
  END IF;
  IF NOT owns THEN
   texts:=' '||public.office_normalize(concat_ws(' ',b->>'parties',a->>'client',a->>'clientNames',jsonb_path_query_array(b,'$.courtSources[*].parties[*].name')::text,jsonb_path_query_array(b,'$.courtSources[*].representedClients[*].name')::text))||' ';
   FOR p IN SELECT value FROM jsonb_array_elements(coalesce(doc->'portfolios','[]')) WHERE public.office_owner(value->>'lawyer')=own LOOP
    FOR client IN SELECT value FROM jsonb_array_elements_text(coalesce(p->'clients','[]')) LOOP
     IF public.office_normalize(client)<>'' AND strpos(texts,' '||public.office_normalize(client)||' ')>0 THEN owns:=true; END IF;
     IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(doc->'clientAliases','[]')) x WHERE public.office_normalize(x->>'client')=public.office_normalize(client) AND public.office_normalize(x->>'alias')<>'' AND strpos(texts,' '||public.office_normalize(x->>'alias')||' ')>0) THEN owns:=true; END IF;
    END LOOP;
   END LOOP;
  END IF;
  IF owns THEN ids:=array_append(ids,b->>'id'); END IF;
 END LOOP;
 RETURN ids;
END $$;
CREATE OR REPLACE FUNCTION public.office_project_dashboard(doc jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE own text:=public.office_lawyer(); ids text[]; result jsonb; portfolio jsonb; rows jsonb; actor text:=auth.uid()::text;
BEGIN
 IF public.office_admin() THEN RETURN doc||jsonb_build_object('officeAccess',jsonb_build_object('version',1,'scope','all'),'officeCourtCacheVersion',(SELECT version FROM office_private.court_cache WHERE id=1)); END IF;
 IF own IS NULL THEN RETURN NULL; END IF;
 ids:=public.office_case_ids(doc);
 SELECT value INTO portfolio FROM jsonb_array_elements(coalesce(doc->'portfolios','[]')) WHERE public.office_owner(value->>'lawyer')=own LIMIT 1;
 -- O vínculo é definido pela conta autorizada, nunca pelo nome editável do perfil.
 portfolio:=coalesce(portfolio,jsonb_build_object('lawyer',initcap(own),'clients','[]'::jsonb));
 portfolio:=portfolio||jsonb_build_object('email',auth.jwt()->>'email','profileUserId',actor);
 result:=jsonb_build_object('officeAccess',jsonb_build_object('version',1,'scope','own','lawyer',portfolio->>'lawyer'),'portfolios',jsonb_build_array(portfolio),'annotations','{}'::jsonb,'base','[]'::jsonb,'deadlines','[]'::jsonb);
 SELECT coalesce(jsonb_agg(value),'[]') INTO rows FROM jsonb_array_elements(coalesce(doc->'base','[]')) WHERE value->>'id'=ANY(ids);result:=result||jsonb_build_object('base',rows);
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO rows FROM jsonb_each(coalesce(doc->'annotations','{}')) WHERE key=ANY(ids);result:=result||jsonb_build_object('annotations',rows);
 SELECT coalesce(jsonb_agg(value),'[]') INTO rows FROM jsonb_array_elements(coalesce(doc->'deadlines','[]')) WHERE value->>'caseId'=ANY(ids) AND (coalesce(value->>'owner','')='' OR public.office_has_owner(value->'owner',own));result:=result||jsonb_build_object('deadlines',rows);
 SELECT coalesce(jsonb_agg(value),'[]') INTO rows FROM jsonb_array_elements(coalesce((SELECT data FROM office_private.court_cache WHERE id=1),doc->'courtPublications','[]')) WHERE value->>'caseId'=ANY(ids);result:=result||jsonb_build_object('courtPublications',rows);
 SELECT coalesce(jsonb_agg(value),'[]') INTO rows FROM jsonb_array_elements(coalesce(doc->'clientAliases','[]')) alias_row WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(portfolio->'clients','[]')) c WHERE public.office_normalize(c)=public.office_normalize(alias_row.value->>'client'));result:=result||jsonb_build_object('clientAliases',rows);
 -- Não devolve configurações globais, tokens, snapshots compactados ou logs com before/after de outras carteiras.
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e->'id','at',e->'at','kind',e->'kind','title',e->'title','actorId',e->'actorId','actorName',e->'actorName','caseIds',(SELECT coalesce(jsonb_agg(v),'[]') FROM jsonb_array_elements_text(coalesce(e->'caseIds','[]')) v WHERE v=ANY(ids)))),'[]') INTO rows FROM jsonb_array_elements(coalesce(doc->'activityLog','[]')) e WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(e->'caseIds','[]')) v WHERE v=ANY(ids));result:=result||jsonb_build_object('activityLog',rows);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e->'id','file',e->'file','importedAt',e->'importedAt','actorId',e->'actorId','actorName',e->'actorName','actorEmail',e->'actorEmail')||jsonb_build_object('caseIds',(SELECT coalesce(jsonb_agg(v),'[]') FROM jsonb_array_elements_text(coalesce(e->'caseIds','[]')) v WHERE v=ANY(ids)),'publicationKeys',(SELECT coalesce(jsonb_agg(v),'[]') FROM jsonb_array_elements(coalesce(e->'publicationKeys','[]')) v WHERE v->>'caseId'=ANY(ids)))),'[]') INTO rows FROM jsonb_array_elements(coalesce(doc->'imports','[]')) e WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(e->'caseIds','[]')) v WHERE v=ANY(ids));result:=result||jsonb_build_object('imports',rows);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e->'id','file',e->'file','availableOn',e->'availableOn','publishedOn',e->'publishedOn','scoped',true,'caseIds',(SELECT coalesce(jsonb_agg(v),'[]') FROM jsonb_array_elements_text(coalesce(e->'caseIds','[]')) v WHERE v=ANY(ids)))),'[]') INTO rows FROM jsonb_array_elements(coalesce(doc->'publicationReports','[]')) e WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(e->'caseIds','[]')) v WHERE v=ANY(ids));result:=result||jsonb_build_object('publicationReports',rows);
 SELECT coalesce(jsonb_agg(value),'[]') INTO rows FROM jsonb_array_elements(coalesce(doc->'forwardEmails','[]')) WHERE value->>'caseId'=ANY(ids) AND public.office_owner(value->>'lawyer')=own;result:=result||jsonb_build_object('forwardEmails',rows);
 SELECT coalesce(jsonb_agg(value),'[]') INTO rows FROM jsonb_array_elements(coalesce(doc->'publicationMail','[]')) WHERE public.office_owner(value->>'lawyer')=own AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(value->'items','[]')) item WHERE NOT item->>'caseId'=ANY(ids));result:=result||jsonb_build_object('publicationMail',rows);
 SELECT coalesce(jsonb_agg(value),'[]') INTO rows FROM jsonb_array_elements(coalesce(doc->'priorityReminders','[]')) WHERE value->>'caseId'=ANY(ids) AND public.office_owner(coalesce(value->>'owner',value->>'lawyer'))=own;result:=result||jsonb_build_object('priorityReminders',rows);
 SELECT coalesce(jsonb_agg(value-'pendingIds'),'[]') INTO rows FROM jsonb_array_elements(coalesce(doc->'deadlineReviews','[]')) WHERE public.office_owner(value->>'owner')=own;result:=result||jsonb_build_object('deadlineReviews',rows);
 RETURN result;
END $$;

CREATE OR REPLACE VIEW public.dashboards WITH (security_barrier=true) AS
 SELECT id, public.office_project_dashboard(data) AS data, revision FROM office_private.dashboards
 WHERE public.office_admin() OR public.office_lawyer() IS NOT NULL;
REVOKE ALL ON public.dashboards FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.dashboards TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.office_write_dashboard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE current_doc jsonb; current_revision bigint; visible jsonb; patched jsonb; own text:=public.office_lawyer(); ids text[]; k text; field text; pair record; prior jsonb; desired jsonb; raw jsonb; entries jsonb; exists_private boolean; e jsonb;
DECLARE annotation_fields text[]:=ARRAY['client','clientNames','notes','checked','due','status','priority','priorityEmailDate','processState','processStateUpdatedAt','processStateUpdatedBy','processStateUpdatedByName'];
DECLARE deadline_fields text[]:=ARRAY['title','date','time','publicationDate','businessDays','excludedDates','excludeRecess','calendar','manualDate','reference','kind','status','readAt','readBy','readByName','completedAt','completedBy','completedByName','completionReport','completionNotes','updatedAt','validatedAt','validatedBy','validatedByName','calculatedAt','calculatedBy'];
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.revision IS DISTINCT FROM OLD.revision+1 THEN RAISE EXCEPTION 'Revisão inválida.' USING ERRCODE='42501'; END IF;
 SELECT data,revision INTO current_doc,current_revision FROM office_private.dashboards WHERE id=OLD.id FOR UPDATE;
 IF NOT FOUND OR current_revision<>OLD.revision THEN RETURN NULL; END IF;
 IF jsonb_typeof(NEW.data)<>'object' THEN RAISE EXCEPTION 'Documento inválido.' USING ERRCODE='42501'; END IF;
 IF public.office_admin() THEN
  patched:=NEW.data-ARRAY['officeAccess','officeCourtCacheVersion'];
 ELSE
  IF own IS NULL THEN RAISE EXCEPTION 'Conta não autorizada.' USING ERRCODE='42501'; END IF;
  visible:=public.office_project_dashboard(current_doc);ids:=public.office_case_ids(current_doc);patched:=current_doc;
  IF (NEW.data-ARRAY['annotations','deadlines','activityLog','deadlineReviews']) IS DISTINCT FROM (visible-ARRAY['annotations','deadlines','activityLog','deadlineReviews']) THEN RAISE EXCEPTION 'Somente a administração pode alterar carteiras, importações e configurações.' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(NEW.data->'annotations')<>'object' OR jsonb_typeof(NEW.data->'deadlines')<>'array' THEN RAISE EXCEPTION 'Dados inválidos.' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(visible->'annotations') key WHERE NOT (NEW.data->'annotations') ? key) THEN RAISE EXCEPTION 'Não é permitido apagar processos.' USING ERRCODE='42501'; END IF;
  FOR pair IN SELECT * FROM jsonb_each(NEW.data->'annotations') LOOP
   IF NOT pair.key=ANY(ids) THEN RAISE EXCEPTION 'Processo fora da carteira.' USING ERRCODE='42501'; END IF;
   prior:=coalesce(visible->'annotations'->pair.key,'{}');desired:=pair.value;raw:=coalesce(current_doc->'annotations'->pair.key,'{}');
   IF desired-(annotation_fields||ARRAY['portfolioOwners','portfolioClients']) IS DISTINCT FROM prior-(annotation_fields||ARRAY['portfolioOwners','portfolioClients']) THEN RAISE EXCEPTION 'Não é permitido alterar encaminhamentos.' USING ERRCODE='42501'; END IF;
   FOREACH field IN ARRAY annotation_fields LOOP
    IF prior->field IS DISTINCT FROM desired->field THEN
     IF desired ? field THEN raw:=jsonb_set(raw,ARRAY[field],desired->field,true);ELSE raw:=raw-field;END IF;
    END IF;
   END LOOP;
   patched:=jsonb_set(patched,ARRAY['annotations'],coalesce(patched->'annotations','{}')||jsonb_build_object(pair.key,raw),true);
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(visible->'deadlines') x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.data->'deadlines') y WHERE y->>'id'=x->>'id')) THEN RAISE EXCEPTION 'Não é permitido apagar prazos.' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(NEW.data->'deadlines'))<>(SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(NEW.data->'deadlines')) THEN RAISE EXCEPTION 'Prazo sem identificador ou duplicado.' USING ERRCODE='42501'; END IF;
  FOR desired IN SELECT value FROM jsonb_array_elements(NEW.data->'deadlines') LOOP
   IF NOT coalesce(desired->>'caseId','')=ANY(ids) THEN RAISE EXCEPTION 'Prazo fora da carteira.' USING ERRCODE='42501'; END IF;
   SELECT value INTO prior FROM jsonb_array_elements(visible->'deadlines') WHERE value->>'id'=desired->>'id';
   SELECT value INTO raw FROM jsonb_array_elements(coalesce(current_doc->'deadlines','[]')) WHERE value->>'id'=desired->>'id';exists_private:=FOUND;
   IF exists_private THEN
    IF prior IS NULL OR desired-deadline_fields IS DISTINCT FROM prior-deadline_fields THEN RAISE EXCEPTION 'Não é permitido alterar responsáveis ou prazos de outra carteira.' USING ERRCODE='42501'; END IF;
    IF desired->>'status' NOT IN ('pending','done') AND desired->>'status' IS DISTINCT FROM prior->>'status' THEN RAISE EXCEPTION 'Situação inválida.' USING ERRCODE='42501'; END IF;
    FOREACH field IN ARRAY deadline_fields LOOP
     IF prior->field IS DISTINCT FROM desired->field THEN
      IF desired ? field THEN raw:=jsonb_set(raw,ARRAY[field],desired->field,true);ELSE raw:=raw-field;END IF;
     END IF;
    END LOOP;
    SELECT jsonb_agg(CASE WHEN value->>'id'=raw->>'id' THEN raw ELSE value END) INTO entries FROM jsonb_array_elements(patched->'deadlines');patched:=jsonb_set(patched,'{deadlines}',entries);
   ELSE
    IF coalesce(desired->>'owner','')<>'' AND NOT public.office_has_owner(desired->'owner',own) THEN RAISE EXCEPTION 'Responsável inválido.' USING ERRCODE='42501'; END IF;
    IF coalesce(desired->>'status','') NOT IN ('pending','done') OR (desired ? 'legacyCaseId' AND desired->>'legacyCaseId' IS DISTINCT FROM desired->>'caseId') THEN RAISE EXCEPTION 'Novo prazo inválido.' USING ERRCODE='42501'; END IF;
    patched:=jsonb_set(patched,'{deadlines}',coalesce(patched->'deadlines','[]')||jsonb_build_array(desired),true);
   END IF;
  END LOOP;
  -- Logs e conferências são acrescentados sem apagar registros dos colegas.
  FOR e IN SELECT value FROM jsonb_array_elements(coalesce(NEW.data->'activityLog','[]')) LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(current_doc->'activityLog','[]')) x WHERE x->>'id'=e->>'id') THEN
    IF e->>'actorId' IS DISTINCT FROM auth.uid()::text OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(e->'caseIds','[]')) c WHERE NOT c=ANY(ids)) THEN RAISE EXCEPTION 'Atividade fora da carteira.' USING ERRCODE='42501'; END IF;
    patched:=jsonb_set(patched,'{activityLog}',coalesce(patched->'activityLog','[]')||jsonb_build_array(e),true);
   END IF;
  END LOOP;
  FOR e IN SELECT value FROM jsonb_array_elements(coalesce(NEW.data->'deadlineReviews','[]')) LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(current_doc->'deadlineReviews','[]')) x WHERE x->>'at'=e->>'at' AND x->>'by'=e->>'by') THEN
    IF e->>'by' IS DISTINCT FROM auth.uid()::text OR (coalesce(e->>'owner','')<>'' AND NOT public.office_has_owner(e->'owner',own)) THEN RAISE EXCEPTION 'Conferência inválida.' USING ERRCODE='42501'; END IF;
    e:=e||jsonb_build_object('owner',visible->'officeAccess'->>'lawyer');
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(e->'pendingIds','[]')) v WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.data->'deadlines') d WHERE d->>'id'=v)) THEN RAISE EXCEPTION 'Conferência fora da carteira.' USING ERRCODE='42501'; END IF;
    patched:=jsonb_set(patched,'{deadlineReviews}',coalesce(patched->'deadlineReviews','[]')||jsonb_build_array(e),true);
   END IF;
  END LOOP;
 END IF;
 UPDATE office_private.dashboards SET data=patched,revision=NEW.revision WHERE id=OLD.id;
 NEW.data:=public.office_project_dashboard(patched);RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS office_dashboard_write ON public.dashboards;
CREATE TRIGGER office_dashboard_write INSTEAD OF UPDATE ON public.dashboards FOR EACH ROW EXECUTE FUNCTION public.office_write_dashboard();
REVOKE ALL ON FUNCTION public.office_admin(),public.office_lawyer(),public.office_normalize(text),public.office_owner(text),public.office_has_owner(jsonb,text),public.office_case_ids(jsonb),public.office_project_dashboard(jsonb),public.office_write_dashboard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_admin(),public.office_lawyer(),public.office_project_dashboard(jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.office_sync_profile(p_oab text DEFAULT NULL,p_uf text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE own text:=public.office_lawyer(); doc jsonb; new_portfolios jsonb;
BEGIN
 IF own IS NULL THEN RAISE EXCEPTION 'Conta não autorizada.' USING ERRCODE='42501'; END IF;
 IF (p_oab IS NOT NULL AND p_oab!~'^[0-9]{1,7}$') OR (p_uf IS NOT NULL AND p_uf NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')) THEN RAISE EXCEPTION 'OAB inválida.'; END IF;
 SELECT data INTO doc FROM office_private.dashboards WHERE id=1 FOR UPDATE;
 SELECT jsonb_agg(CASE WHEN public.office_owner(value->>'lawyer')=own THEN value||jsonb_build_object('email',auth.jwt()->>'email','profileUserId',auth.uid()::text)||CASE WHEN p_oab IS NOT NULL AND p_uf IS NOT NULL THEN jsonb_build_object('oab',p_oab,'uf',p_uf) ELSE '{}'::jsonb END ELSE value END) INTO new_portfolios FROM jsonb_array_elements(coalesce(doc->'portfolios','[]'));
 IF new_portfolios IS DISTINCT FROM doc->'portfolios' THEN UPDATE office_private.dashboards SET data=jsonb_set(data,'{portfolios}',new_portfolios),revision=revision+1 WHERE id=1;RETURN true;END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.office_sync_profile(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.office_sync_profile(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.office_fill_court_cache(p_version text,p_entries jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT public.office_admin() THEN RAISE EXCEPTION 'Somente a administração pode sincronizar a fonte dos tribunais.' USING ERRCODE='42501'; END IF;
 IF p_version IS NULL OR length(p_version)>300 OR jsonb_typeof(p_entries)<>'array' OR jsonb_array_length(p_entries)>100000 THEN RAISE EXCEPTION 'Fonte inválida.'; END IF;
 IF EXISTS(SELECT 1 FROM office_private.court_cache WHERE id=1 AND version=p_version) THEN RETURN false; END IF;
 INSERT INTO office_private.court_cache(id,version,data) VALUES(1,p_version,p_entries) ON CONFLICT(id) DO UPDATE SET version=excluded.version,data=excluded.data;
 UPDATE office_private.dashboards SET revision=revision+1 WHERE id=1;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.office_fill_court_cache(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.office_fill_court_cache(text,jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.office_access_version() RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.office_access_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.office_access_version() TO anon,authenticated,service_role;
-- Faz clientes já abertos buscarem novamente a carteira filtrada.
UPDATE office_private.dashboards SET revision=revision+1;
NOTIFY pgrst,'reload schema';
COMMIT;

SELECT 'Permissões por conta: versão 1' AS status, (SELECT count(*) FROM office_private.dashboards) AS documentos_preservados;
