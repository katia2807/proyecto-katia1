import { redirect } from "next/navigation";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  let context = null;
  try {
    context = await getAuthContext();
  } catch {
    context = null;
  }
  if (context) redirect("/");

  return (
    <AuthSplitLayout
      title="Restablecer contraseña"
      subtitle="Ingresa tu correo y te enviaremos instrucciones para recuperar el acceso."
    >
      <ForgotPasswordForm />
    </AuthSplitLayout>
  );
}
