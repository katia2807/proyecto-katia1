export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole =
  | "owner_admin"
  | "gerencia"
  | "vendedor"
  | "almacen"
  | "caja"
  | "operaciones_caja"
  | "ventas"
  | "rrhh"
  | "partner_readonly";

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
      };
      perfiles: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          role: AppRole;
          full_name: string | null;
          created_at: string;
          ui_role: "owner_admin" | "operaciones" | "readonly" | null;
          deactivated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          role: AppRole;
          full_name?: string | null;
          created_at?: string;
          ui_role?: "owner_admin" | "operaciones" | "readonly" | null;
          deactivated_at?: string | null;
        };
        Update: {
          role?: AppRole;
          full_name?: string | null;
          ui_role?: "owner_admin" | "operaciones" | "readonly" | null;
          deactivated_at?: string | null;
        };
      };
      clientes: {
        Row: {
          id: string;
          organization_id: string;
          nombre: string;
          documento: string | null;
          telefono: string | null;
          ruc: string | null;
          direccion: string | null;
          tipo_persona: "natural" | "empresa" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nombre: string;
          documento?: string | null;
          telefono?: string | null;
          ruc?: string | null;
          direccion?: string | null;
          tipo_persona?: "natural" | "empresa" | null;
          created_at?: string;
        };
        Update: {
          nombre?: string;
          documento?: string | null;
          telefono?: string | null;
          ruc?: string | null;
          direccion?: string | null;
          tipo_persona?: "natural" | "empresa" | null;
        };
      };
      choferes: {
        Row: {
          id: string;
          organization_id: string;
          nombre: string;
          telefono: string | null;
          placa: string | null;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nombre: string;
          telefono?: string | null;
          placa?: string | null;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          nombre?: string;
          telefono?: string | null;
          placa?: string | null;
          activo?: boolean;
        };
      };
      proveedores: {
        Row: {
          id: string;
          organization_id: string;
          nombre: string;
          documento: string | null;
          telefono: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nombre: string;
          documento?: string | null;
          telefono?: string | null;
          created_at?: string;
        };
        Update: {
          nombre?: string;
          documento?: string | null;
          telefono?: string | null;
        };
      };
      servicios_aserradero: {
        Row: {
          id: string;
          organization_id: string;
          cliente_id: string;
          fecha: string;
          pies_cubicos: number;
          costo_cubicaje: number;
          precio_cobrado: number;
          utilidad: number;
          lineas_json: Json;
          correlativo: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          cliente_id: string;
          fecha: string;
          pies_cubicos: number;
          costo_cubicaje: number;
          precio_cobrado: number;
          utilidad: number;
          lineas_json?: Json;
          correlativo?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          fecha?: string;
          pies_cubicos?: number;
          costo_cubicaje?: number;
          precio_cobrado?: number;
          utilidad?: number;
          lineas_json?: Json;
          correlativo?: string | null;
        };
      };
      security_control_items: {
        Row: {
          id: string;
          organization_id: string;
          sort_order: number;
          title: string;
          owner: string;
          completed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sort_order?: number;
          title: string;
          owner?: string;
          completed?: boolean;
          updated_at?: string;
        };
        Update: {
          sort_order?: number;
          title?: string;
          owner?: string;
          completed?: boolean;
          updated_at?: string;
        };
      };
      servicios_especiales_tarifa: {
        Row: {
          id: string;
          organization_id: string;
          codigo: string;
          nombre: string;
          tarifa_por_pieza: number;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          codigo: string;
          nombre: string;
          tarifa_por_pieza: number;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          codigo?: string;
          nombre?: string;
          tarifa_por_pieza?: number;
          activo?: boolean;
        };
      };
      registro_categorias: {
        Row: {
          id: string;
          organization_id: string;
          codigo: string;
          nombre: string;
          descripcion: string | null;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          codigo: string;
          nombre: string;
          descripcion?: string | null;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          codigo?: string;
          nombre?: string;
          descripcion?: string | null;
          activo?: boolean;
        };
      };
      registros_generales: {
        Row: {
          id: string;
          organization_id: string;
          categoria_id: string;
          fecha: string;
          titulo: string;
          detalle: string | null;
          monto: number | null;
          metadata: Json;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          categoria_id: string;
          fecha?: string;
          titulo: string;
          detalle?: string | null;
          monto?: number | null;
          metadata?: Json;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          categoria_id?: string;
          fecha?: string;
          titulo?: string;
          detalle?: string | null;
          monto?: number | null;
          metadata?: Json;
        };
      };
      compras_madera: {
        Row: {
          id: string;
          organization_id: string;
          proveedor_id: string;
          fecha: string;
          especie_madera: string;
          detalle: string | null;
          cantidad: number;
          unidad: string;
          precio_unitario: number;
          total: number;
          modalidad_pago: "contado" | "fiado";
          adelanto: number;
          saldo_pendiente: number;
          estado: "borrador" | "confirmada";
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          proveedor_id: string;
          fecha: string;
          especie_madera: string;
          detalle?: string | null;
          cantidad: number;
          unidad?: string;
          precio_unitario: number;
          total: number;
          modalidad_pago?: "contado" | "fiado";
          adelanto?: number;
          saldo_pendiente?: number;
          estado?: "borrador" | "confirmada";
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          fecha?: string;
          especie_madera?: string;
          detalle?: string | null;
          cantidad?: number;
          unidad?: string;
          precio_unitario?: number;
          total?: number;
          modalidad_pago?: "contado" | "fiado";
          adelanto?: number;
          saldo_pendiente?: number;
          estado?: "borrador" | "confirmada";
        };
      };
      movimientos_caja: {
        Row: {
          id: string;
          organization_id: string;
          fecha: string;
          tipo: "ingreso" | "egreso" | "transferencia";
          medio: "efectivo" | "banco" | "yape" | "otro";
          categoria: string;
          monto: number;
          descripcion: string | null;
          es_personal: boolean;
          modulo_origen: string | null;
          referencia_id: string | null;
          periodo_cerrado: boolean;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          url_comprobante: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          fecha: string;
          tipo: "ingreso" | "egreso" | "transferencia";
          medio: "efectivo" | "banco" | "yape" | "otro";
          categoria: string;
          monto: number;
          descripcion?: string | null;
          es_personal?: boolean;
          modulo_origen?: string | null;
          referencia_id?: string | null;
          url_comprobante?: string | null;
        };
        Update: {
          fecha?: string;
          tipo?: "ingreso" | "egreso" | "transferencia";
          medio?: "efectivo" | "banco" | "yape" | "otro";
          categoria?: string;
          monto?: number;
          descripcion?: string | null;
          es_personal?: boolean;
          modulo_origen?: string | null;
          referencia_id?: string | null;
          url_comprobante?: string | null;
        };
      };
      muebles_catalogo: {
        Row: {
          id: string;
          organization_id: string;
          codigo: string;
          nombre: string;
          descripcion: string | null;
          precio_lista: number;
          stock_disponible: number;
          foto_url: string | null;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          codigo: string;
          nombre: string;
          descripcion?: string | null;
          precio_lista?: number;
          stock_disponible?: number;
          foto_url?: string | null;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          codigo?: string;
          nombre?: string;
          descripcion?: string | null;
          precio_lista?: number;
          stock_disponible?: number;
          foto_url?: string | null;
          activo?: boolean;
        };
      };
      ordenes_produccion: {
        Row: {
          id: string;
          organization_id: string;
          cliente_id: string;
          cotizacion_id: string | null;
          cotizacion_unificada_id: string | null;
          estado: "en_produccion" | "terminado" | "entregado";
          notas: string | null;
          fecha_aprobacion: string;
          correlativo: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          cliente_id: string;
          cotizacion_id?: string | null;
          cotizacion_unificada_id?: string | null;
          estado?: "en_produccion" | "terminado" | "entregado";
          notas?: string | null;
          fecha_aprobacion?: string;
          correlativo?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          estado?: "en_produccion" | "terminado" | "entregado";
          notas?: string | null;
          correlativo?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      zonas_entrega: {
        Row: {
          id: string;
          organization_id: string;
          nombre: string;
          distancia_km: number;
          tarifa: number;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nombre: string;
          distancia_km: number;
          tarifa: number;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          nombre?: string;
          distancia_km?: number;
          tarifa?: number;
          activo?: boolean;
        };
      };
      inventario_productos: {
        Row: {
          id: string;
          organization_id: string;
          codigo: string;
          nombre: string;
          categoria: string;
          unidad: string;
          stock_actual: number;
          stock_minimo: number;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          codigo: string;
          nombre: string;
          categoria: string;
          unidad: string;
          stock_actual?: number;
          stock_minimo?: number;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          nombre?: string;
          categoria?: string;
          unidad?: string;
          stock_actual?: number;
          stock_minimo?: number;
          activo?: boolean;
        };
      };
      inventario_movimientos: {
        Row: {
          id: string;
          organization_id: string;
          producto_id: string;
          fecha: string;
          tipo: "entrada_compra" | "salida_venta" | "ajuste";
          cantidad: number;
          costo_unitario: number | null;
          referencia: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          producto_id: string;
          fecha: string;
          tipo: "entrada_compra" | "salida_venta" | "ajuste";
          cantidad: number;
          costo_unitario?: number | null;
          referencia?: string | null;
          created_at?: string;
        };
        Update: {
          fecha?: string;
          tipo?: "entrada_compra" | "salida_venta" | "ajuste";
          cantidad?: number;
          costo_unitario?: number | null;
          referencia?: string | null;
        };
      };
      ventas_madera: {
        Row: {
          id: string;
          organization_id: string;
          cliente_id: string;
          fecha: string;
          estado: "borrador" | "confirmada";
          total: number;
          correlativo: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          cliente_id: string;
          fecha: string;
          estado?: "borrador" | "confirmada";
          total?: number;
          correlativo?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          estado?: "borrador" | "confirmada";
          total?: number;
          correlativo?: string | null;
        };
      };
      ventas_madera_cortada: {
        Row: {
          id: string;
          organization_id: string;
          cliente_id: string;
          fecha: string;
          estado: "borrador" | "confirmada";
          tipo_corte: "tabla" | "liston" | "cuarton" | "poste";
          total_pt: number;
          precio_por_pt: number;
          total: number;
          metodo_pago:
            | "efectivo"
            | "yape"
            | "transferencia"
            | "billetera_digital"
            | "otro";
          modalidad_pago: "contado" | "adelanto" | "credito";
          fecha_pago_credito: string | null;
          chofer_id: string | null;
          tipo_entrega: "puesto_en_obra" | "entrega_local" | "envio";
          direccion_entrega: string | null;
          estado_entrega: "pendiente" | "en_proceso" | "entregado";
          inventario_producto_id: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          cliente_id: string;
          fecha: string;
          estado?: "borrador" | "confirmada";
          tipo_corte: "tabla" | "liston" | "cuarton" | "poste";
          total_pt: number;
          precio_por_pt: number;
          total: number;
          metodo_pago:
            | "efectivo"
            | "yape"
            | "transferencia"
            | "billetera_digital"
            | "otro";
          modalidad_pago: "contado" | "adelanto" | "credito";
          fecha_pago_credito?: string | null;
          chofer_id?: string | null;
          tipo_entrega: "puesto_en_obra" | "entrega_local" | "envio";
          direccion_entrega?: string | null;
          estado_entrega?: "pendiente" | "en_proceso" | "entregado";
          inventario_producto_id?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          estado?: "borrador" | "confirmada";
          estado_entrega?: "pendiente" | "en_proceso" | "entregado";
        };
      };
      ventas_mueble_terminado: {
        Row: {
          id: string;
          organization_id: string;
          cliente_id: string;
          mueble_catalogo_id: string;
          cantidad: number;
          precio_unitario: number;
          total: number;
          chofer_id: string | null;
          tipo_entrega: "puesto_en_obra" | "entrega_local" | "envio";
          direccion_entrega: string | null;
          estado_entrega: "pendiente" | "en_proceso" | "entregado";
          metodo_pago:
            | "efectivo"
            | "yape"
            | "transferencia"
            | "billetera_digital"
            | "otro";
          modalidad_pago: "contado" | "adelanto" | "credito";
          fecha_pago_credito: string | null;
          correlativo: string | null;
          fecha: string;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          cliente_id: string;
          mueble_catalogo_id: string;
          cantidad: number;
          precio_unitario: number;
          total: number;
          chofer_id?: string | null;
          tipo_entrega: "puesto_en_obra" | "entrega_local" | "envio";
          direccion_entrega?: string | null;
          estado_entrega?: "pendiente" | "en_proceso" | "entregado";
          metodo_pago:
            | "efectivo"
            | "yape"
            | "transferencia"
            | "billetera_digital"
            | "otro";
          modalidad_pago: "contado" | "adelanto" | "credito";
          fecha_pago_credito?: string | null;
          correlativo?: string | null;
          fecha: string;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          estado_entrega?: "pendiente" | "en_proceso" | "entregado";
          correlativo?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      alquileres: {
        Row: {
          id: string;
          organization_id: string;
          cliente_id: string;
          activo: string;
          fecha_inicio: string;
          fecha_fin: string | null;
          tarifa: number;
          penalidad: number;
          estado: "abierto" | "cerrado";
          created_at: string;
          codigo: string | null;
          representante: string | null;
          ruc_empresa: string | null;
          direccion_ejecucion: string | null;
          fecha_termino: string | null;
          dias_alquiler: number | null;
          tarifa_unidad: "hora_maquina" | "m3" | "dia" | null;
          monto_total: number | null;
          deposito_30: number | null;
          penalidad_retraso_pago_pct: number;
          penalidad_devolucion_tardia_pct: number;
          penalidad_danios_pct: number;
          observaciones_retorno: string | null;
          metodo_pago:
            | "efectivo"
            | "yape"
            | "transferencia"
            | "billetera_digital"
            | "otro"
            | null;
          modalidad_pago: "contado" | "adelanto" | "credito" | null;
          fecha_pago_credito: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          cliente_id: string;
          activo: string;
          fecha_inicio: string;
          fecha_fin?: string | null;
          tarifa: number;
          penalidad?: number;
          estado?: "abierto" | "cerrado";
          created_at?: string;
          codigo?: string | null;
          representante?: string | null;
          ruc_empresa?: string | null;
          direccion_ejecucion?: string | null;
          fecha_termino?: string | null;
          dias_alquiler?: number | null;
          tarifa_unidad?: "hora_maquina" | "m3" | "dia" | null;
          monto_total?: number | null;
          deposito_30?: number | null;
          penalidad_retraso_pago_pct?: number;
          penalidad_devolucion_tardia_pct?: number;
          penalidad_danios_pct?: number;
          observaciones_retorno?: string | null;
          metodo_pago?:
            | "efectivo"
            | "yape"
            | "transferencia"
            | "billetera_digital"
            | "otro"
            | null;
          modalidad_pago?: "contado" | "adelanto" | "credito" | null;
          fecha_pago_credito?: string | null;
        };
        Update: {
          fecha_fin?: string | null;
          tarifa?: number;
          penalidad?: number;
          estado?: "abierto" | "cerrado";
          codigo?: string | null;
          representante?: string | null;
          ruc_empresa?: string | null;
          direccion_ejecucion?: string | null;
          fecha_termino?: string | null;
          dias_alquiler?: number | null;
          tarifa_unidad?: "hora_maquina" | "m3" | "dia" | null;
          monto_total?: number | null;
          deposito_30?: number | null;
          penalidad_retraso_pago_pct?: number;
          penalidad_devolucion_tardia_pct?: number;
          penalidad_danios_pct?: number;
          observaciones_retorno?: string | null;
          metodo_pago?:
            | "efectivo"
            | "yape"
            | "transferencia"
            | "billetera_digital"
            | "otro"
            | null;
          modalidad_pago?: "contado" | "adelanto" | "credito" | null;
          fecha_pago_credito?: string | null;
        };
      };
      empleados: {
        Row: {
          id: string;
          organization_id: string;
          nombre: string;
          rol: string;
          activo: boolean;
          fecha_ingreso: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nombre: string;
          rol: string;
          activo?: boolean;
          fecha_ingreso: string;
          created_at?: string;
        };
        Update: {
          nombre?: string;
          rol?: string;
          activo?: boolean;
          fecha_ingreso?: string;
        };
      };
      sueldos: {
        Row: {
          id: string;
          organization_id: string;
          empleado_id: string;
          periodo: string;
          monto_bruto: number;
          descuentos: number;
          monto_neto: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          empleado_id: string;
          periodo: string;
          monto_bruto: number;
          descuentos?: number;
          monto_neto: number;
          created_at?: string;
        };
        Update: {
          monto_bruto?: number;
          descuentos?: number;
          monto_neto?: number;
        };
      };
      adelantos: {
        Row: {
          id: string;
          organization_id: string;
          empleado_id: string;
          fecha: string;
          monto: number;
          estado: "pendiente" | "descontado_nomina";
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          empleado_id: string;
          fecha: string;
          monto: number;
          estado?: "pendiente" | "descontado_nomina";
          created_at?: string;
        };
        Update: {
          estado?: "pendiente" | "descontado_nomina";
        };
      };
      cierres_mensuales: {
        Row: {
          id: string;
          organization_id: string;
          anio: number;
          mes: number;
          hash_sha256: string;
          reporte_json: Json;
          closed_at: string;
          closed_by: string | null;
          reopened_at: string | null;
          reopened_by: string | null;
          reopen_reason: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          anio: number;
          mes: number;
          hash_sha256: string;
          reporte_json: Json;
          closed_at?: string;
          closed_by?: string | null;
        };
        Update: {
          reopened_at?: string | null;
          reopened_by?: string | null;
          reopen_reason?: string | null;
        };
      };
      alertas_operativas: {
        Row: {
          id: string;
          organization_id: string;
          tipo: "stock_bajo" | "deuda_vencida" | "penalidad_limite" | "anomalia_caja";
          prioridad: "alta" | "media" | "baja";
          estado: "nueva" | "revisada" | "resuelta";
          descripcion: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          tipo: "stock_bajo" | "deuda_vencida" | "penalidad_limite" | "anomalia_caja";
          prioridad: "alta" | "media" | "baja";
          estado?: "nueva" | "revisada" | "resuelta";
          descripcion: string;
          created_at?: string;
        };
        Update: {
          estado?: "nueva" | "revisada" | "resuelta";
        };
      };
      audit_log: {
        Row: {
          id: string;
          organization_id: string;
          action: string;
          entity: string;
          entity_id: string | null;
          payload: Json;
          created_at: string;
          actor_id: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          action: string;
          entity: string;
          entity_id?: string | null;
          payload?: Json;
          created_at?: string;
          actor_id?: string | null;
        };
        Update: never;
      };
      cotizaciones_mueble: {
        Row: {
          id: string;
          organization_id: string;
          cliente_id: string;
          fecha: string;
          tipo: "mueble_personalizado" | "servicio_corte";
          especie_madera: string;
          unidad_medida: "cm" | "in" | "otro";
          origen_material: "cliente" | "empresa";
          precio_calculado: number;
          precio_acordado: number;
          motivo_ajuste: string | null;
          estado: "borrador" | "confirmada";
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          cliente_id: string;
          fecha: string;
          tipo: "mueble_personalizado" | "servicio_corte";
          especie_madera: string;
          unidad_medida: "cm" | "in" | "otro";
          origen_material: "cliente" | "empresa";
          precio_calculado?: number;
          precio_acordado: number;
          motivo_ajuste?: string | null;
          estado?: "borrador" | "confirmada";
          created_at?: string;
        };
        Update: {
          especie_madera?: string;
          unidad_medida?: "cm" | "in" | "otro";
          precio_calculado?: number;
          precio_acordado?: number;
          motivo_ajuste?: string | null;
          estado?: "borrador" | "confirmada";
        };
      };
      correlativos: {
        Row: {
          org_id: string;
          tipo: string;
          ultimo_valor: number;
        };
        Insert: {
          org_id: string;
          tipo: string;
          ultimo_valor?: number;
        };
        Update: {
          ultimo_valor?: number;
        };
      };
      cotizacion_cortes: {
        Row: {
          id: string;
          cotizacion_id: string;
          tipo_pieza: "tabla" | "liston";
          espesor: number;
          ancho: number;
          largo: number;
          cantidad: number;
          valor_calculado: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          cotizacion_id: string;
          tipo_pieza: "tabla" | "liston";
          espesor: number;
          ancho: number;
          largo: number;
          cantidad?: number;
          valor_calculado?: number;
          created_at?: string;
        };
        Update: {
          espesor?: number;
          ancho?: number;
          largo?: number;
          cantidad?: number;
          valor_calculado?: number;
        };
      };
      cotizaciones_unificadas: {
        Row: {
          id: string;
          organization_id: string;
          cliente_id: string;
          fecha: string;
          correlativo: string | null;
          tipo_cliente: "natural" | "empresa";
          total: number;
          estado_flujo: "pendiente" | "lista_produccion" | "en_produccion" | "cobrada";
          detalle: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          cliente_id: string;
          fecha?: string;
          correlativo?: string | null;
          tipo_cliente: "natural" | "empresa";
          total?: number;
          estado_flujo?: "pendiente" | "lista_produccion" | "en_produccion" | "cobrada";
          detalle?: Json;
          created_at?: string;
        };
        Update: {
          fecha?: string;
          correlativo?: string | null;
          tipo_cliente?: "natural" | "empresa";
          total?: number;
          estado_flujo?: "pendiente" | "lista_produccion" | "en_produccion" | "cobrada";
          detalle?: Json;
        };
      };
    };
    Views: {
      utilidad_mensual: {
        Row: {
          organization_id: string;
          anio: number;
          mes: number;
          ingresos: number;
          egresos: number;
          sueldos: number;
          utilidad_neta: number;
        };
      };
    };
    Functions: {
      cerrar_mes: {
        Args: { p_org_id: string; p_anio: number; p_mes: number };
        Returns: string;
      };
      next_correlativo_valor: {
        Args: { p_org_id: string; p_tipo: string };
        Returns: number;
      };
    };
  };
};
