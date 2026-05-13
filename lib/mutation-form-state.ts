/** Estado estándar para server actions usadas con `useActionState` y feedback/toast. */
export type MutationFormState = {
  success: boolean;
  error: string | null;
  message: string | null;
};

export const mutationFormInitialState: MutationFormState = {
  success: false,
  error: null,
  message: null,
};
