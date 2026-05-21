# PATCH para app/actions.ts
# Archivo: app/actions.ts
# Cambios: 2 reemplazos dentro de `createCliente`

## REEMPLAZO 1 — rama demo (sin Supabase)

### BUSCA esto (exacto):
```
  if (!hasSupabaseEnv()) {
    demoCreateCliente({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre,
      documento: parsed.data.documento || null,
      telefono: parsed.data.telefono || null,
      ruc: parsed.data.ruc || null,
      direccion: parsed.data.direccion || null,
      tipo_persona: tipoPersona,
    });
  } else {
```

### REEMPLAZA por:
```
  if (!hasSupabaseEnv()) {
    const newId = demoCreateCliente({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre,
      documento: parsed.data.documento || null,
      telefono: parsed.data.telefono || null,
      ruc: parsed.data.ruc || null,
      direccion: parsed.data.direccion || null,
      tipo_persona: tipoPersona,
    });
    revalidatePath("/ventas");
    revalidatePath("/alquiler");
    const skipRedirect = formData.get("skip_redirect") === "true";
    if (skipRedirect) return { id: newId, nombre: parsed.data.nombre };
    maybeRedirectToQuickStep(formData);
    return;
  } else {
```

---

## REEMPLAZO 2 — rama Supabase

### BUSCA esto (exacto):
```
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("clientes").insert({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre,
      documento: parsed.data.documento || parsed.data.ruc || null,
      telefono: parsed.data.telefono || null,
      ruc: parsed.data.ruc || null,
      direccion: parsed.data.direccion || null,
      tipo_persona: tipoPersona,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/ventas");
  revalidatePath("/alquiler");
  maybeRedirectToQuickStep(formData);
}
```

### REEMPLAZA por:
```
    const supabase = getSupabaseServerClient();
    const { data: newCliente, error } = await supabase
      .from("clientes")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        nombre: parsed.data.nombre,
        documento: parsed.data.documento || parsed.data.ruc || null,
        telefono: parsed.data.telefono || null,
        ruc: parsed.data.ruc || null,
        direccion: parsed.data.direccion || null,
        tipo_persona: tipoPersona,
      })
      .select("id")
      .single();
    if (error) {
      throw new Error(error.message);
    }
    revalidatePath("/ventas");
    revalidatePath("/alquiler");
    const skipRedirect = formData.get("skip_redirect") === "true";
    if (skipRedirect) return { id: newCliente.id, nombre: parsed.data.nombre };
    maybeRedirectToQuickStep(formData);
    return;
  }
}
```
