import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <AuthSplitLayout
      title="Nueva contraseña"
      subtitle="Define una nueva contraseña segura para tu cuenta."
    >
      <ResetPasswordForm />
    </AuthSplitLayout>
  );
}
