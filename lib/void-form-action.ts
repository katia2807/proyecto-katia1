/**
 * Adapta server actions que pueden devolver datos (p. ej. `{ ok: false, error }`)
 * al tipo que espera `<form action>` en React. El valor de retorno se descarta en el cliente.
 */
export function voidFormAction(fn: (formData: FormData) => Promise<unknown>): (formData: FormData) => Promise<void> {
  return async (formData) => {
    await fn(formData);
  };
}
