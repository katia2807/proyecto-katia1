alter table clientes
  add column if not exists ruc text,
  add column if not exists direccion text,
  add column if not exists tipo_persona text;

alter table clientes
  drop constraint if exists clientes_tipo_persona_check,
  add constraint clientes_tipo_persona_check
    check (tipo_persona is null or tipo_persona in ('natural', 'empresa'));
