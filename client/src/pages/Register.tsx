import { useEffect } from "react";
import { Helmet } from "react-helmet";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import RegisterForm from "@/components/auth/RegisterForm";

export default function Register() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="flex min-h-screen bg-neutral-100 items-center justify-center p-4">
      <Helmet>
        <title>{t("register.pageTitle")} | {t("app.title")}</title>
      </Helmet>
      <RegisterForm />
    </div>
  );
}
