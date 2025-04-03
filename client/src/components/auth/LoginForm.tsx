import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LanguageSelector from "@/components/layout/LanguageSelector";
import { useToast } from "@/hooks/use-toast";

// Form schema for login
const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Handle form submission
  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      await login(values.email, values.password);
      // Login successful (redirect handled in AuthContext)
    } catch (error) {
      toast({
        title: t("login.error"),
        description: t("login.invalidCredentials"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <div className="flex justify-between items-center p-6 pb-2">
        <h1 className="text-2xl font-heading font-semibold text-primary">
          {t("app.title")}
        </h1>
        <LanguageSelector />
      </div>
      
      <CardContent className="p-6">
        <Tabs defaultValue="login" className="mb-6">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="login" className="font-medium">
              {t("login.title")}
            </TabsTrigger>
            <TabsTrigger value="register" asChild>
              <Link to="/register" className="font-medium text-muted-foreground hover:text-foreground transition-colors">
                {t("register.title")}
              </Link>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.email")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="email@example.com"
                          type="email"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.password")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="********"
                          type="password"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full bg-primary hover:bg-primary-dark" disabled={isLoading}>
                  {isLoading ? t("common.loading") : t("login.submit")}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>

        <div className="text-center text-sm text-muted-foreground">
          <p>{t("login.joinAsParticipant")}</p>
          <Button variant="link" asChild className="mt-2 text-primary hover:text-primary/80 font-medium">
            <Link to="/join">{t("login.joinWithLink")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
