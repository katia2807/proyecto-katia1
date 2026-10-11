'use client';
import { useEffect, useState } from 'react';
import type { MutationFormState } from '@/lib/mutation-form-state';
/** Conserva la misma solicitud ante errores; después de éxito empieza otra. */
export function OperationSubmissionId({ state }: {
    state: MutationFormState;
}) {
    const [id, setId] = useState('');
    useEffect(() => { setId(crypto.randomUUID()); }, []);
    useEffect(() => { if (state.success)
        setId(crypto.randomUUID()); }, [state]);
    return <input type="hidden" name="submission_id" value={id}/>;
}
