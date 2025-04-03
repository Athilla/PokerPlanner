import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";

// Form schema for joining a session
const joinSessionSchema = z.object({
  sessionId: z.string().uuid({ message: "Invalid session link format" }),
  alias: z.string().min(1, { message: "Alias is required" }).max(50, { message: "Alias cannot be longer than 50 characters" }),
});

type JoinSessionFormValues = z.infer<typeof joinSessionSchema>;

interface JoinSessionFormProps {
  sessionId?: string;
  sessionName?: string;
  onJoinSuccess: (participantId: string, sessionId: string, alias: string) => void;
}

export default function JoinSessionForm({ sessionId: initialSessionId, sessionName, onJoinSuccess }: JoinSessionFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form
  const form = useForm<JoinSessionFormValues>({
    resolver: zodResolver(joinSessionSchema),
    defaultValues: {
      sessionId: initialSessionId || "",
      alias: "",
    },
  });

  // Extract the session ID from a full URL if provided
  const extractSessionId = (value: string): string => {
    try {
      if (value.includes("/join/")) {
        const url = new URL(value);
        const pathSegments = url.pathname.split("/");
        const idIndex = pathSegments.indexOf("join") + 1;
        if (idIndex < pathSegments.length) {
          return pathSegments[idIndex];
        }
      }
    } catch (error) {
      // If URL parsing fails, just return the original value
    }
    return value;
  };

  // Handle form submission
  const onSubmit = async (values: JoinSessionFormValues) => {
    setIsSubmitting(true);
    try {
      const extractedSessionId = extractSessionId(values.sessionId);
      
      const response = await apiRequest("POST", `/api/sessions/${extractedSessionId}/join`, {
        alias: values.alias,
      });

      const data = await response.json();
      onJoinSuccess(data.participant.id, data.sessionId, data.participant.alias);
    } catch (error) {
      console.error("Join session error:", error);
      toast({
        title: t("session.error"),
        description: t("session.joinError"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-heading font-semibold mb-2">
            {t("session.join")}
          </h2>
          {sessionName && (
            <div className="text-sm text-muted-foreground">
              {t("session.joiningSession")}: <span className="font-medium">{sessionName}</span>
            </div>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!initialSessionId && (
              <FormField
                control={form.control}
                name="sessionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("session.sessionLink")}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t("session.sessionLinkPlaceholder")}
                        {...field}
                        onChange={e => {
                          const extractedId = extractSessionId(e.target.value);
                          field.onChange(extractedId);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="alias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("session.yourAlias")}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={t("session.aliasPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("common.loading") : t("session.joinButton")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
