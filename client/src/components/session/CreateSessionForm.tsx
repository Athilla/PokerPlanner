import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { X, Plus, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { generateFibonacciScale } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

// Form schema for creating a session
const userStorySchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
});

const sessionSchema = z.object({
  name: z.string().min(1, { message: "Session name is required" }),
  scaleType: z.enum(["fibonacci", "custom"]),
  customScale: z.string().optional(),
  userStories: z.array(userStorySchema).min(1, { message: "At least one user story is required" }),
  notificationsEnabled: z.boolean().default(false),
});

type SessionFormValues = z.infer<typeof sessionSchema>;

interface CreateSessionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (sessionId: string) => void;
}

export default function CreateSessionForm({ open, onOpenChange, onSuccess }: CreateSessionFormProps) {
  const { t } = useTranslation();
  const { currentUser, token } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form
  const form = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      name: "",
      scaleType: "fibonacci",
      customScale: "",
      userStories: [{ title: "", description: "" }],
      notificationsEnabled: false,
    },
  });

  // For managing user stories array
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "userStories",
  });

  // Add a new user story
  const addUserStory = () => {
    append({ title: "", description: "" });
  };

  // Get the current scale based on form values
  const getCurrentScale = () => {
    const scaleType = form.watch("scaleType");
    if (scaleType === "fibonacci") {
      return generateFibonacciScale();
    } else {
      const customScaleStr = form.watch("customScale") || "";
      // Parse comma-separated values, filter out non-numbers, sort numerically
      return customScaleStr
        .split(",")
        .map(s => s.trim())
        .filter(s => /^\d+$/.test(s))
        .map(Number)
        .sort((a, b) => a - b);
    }
  };

  // Handle form submission
  const onSubmit = async (values: SessionFormValues) => {
    if (!currentUser || !token) {
      toast({
        title: t("session.error"),
        description: t("auth.notAuthenticated"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare scale for the API
      let scale;
      if (values.scaleType === "fibonacci") {
        scale = JSON.stringify(generateFibonacciScale());
      } else {
        const customScale = values.customScale
          ?.split(",")
          .map(s => s.trim())
          .filter(s => /^\d+$/.test(s))
          .map(Number)
          .sort((a, b) => a - b);
        
        if (!customScale || customScale.length === 0) {
          // Fallback to Fibonacci if no valid custom scale
          scale = JSON.stringify(generateFibonacciScale());
        } else if (customScale.length > 100) {
          // Limit to 100 values
          scale = JSON.stringify(customScale.slice(0, 100));
        } else {
          scale = JSON.stringify(customScale);
        }
      }

      // Create session
      const response = await apiRequest("POST", "/api/sessions", {
        name: values.name,
        scale,
        hostId: currentUser.id,
        notificationsEnabled: values.notificationsEnabled,
        userStories: values.userStories,
      });

      const { session } = await response.json();

      // Invalidate sessions query
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });

      // Show success toast
      toast({
        title: t("session.createSuccess"),
        description: t("session.created"),
      });

      // Close the dialog
      onOpenChange(false);

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(session.id);
      }
    } catch (error) {
      console.error("Create session error:", error);
      toast({
        title: t("session.error"),
        description: t("session.createError"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentScale = getCurrentScale();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-semibold">
            {t("session.create")}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("session.name")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="space-y-2">
                <FormLabel>{t("session.votingScale")}</FormLabel>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Button
                    type="button"
                    variant={form.watch("scaleType") === "fibonacci" ? "default" : "outline"}
                    onClick={() => form.setValue("scaleType", "fibonacci")}
                  >
                    {t("session.fibonacci")}
                  </Button>
                  <Button
                    type="button"
                    variant={form.watch("scaleType") === "custom" ? "default" : "outline"}
                    onClick={() => form.setValue("scaleType", "custom")}
                  >
                    {t("session.custom")}
                  </Button>
                </div>
                
                {form.watch("scaleType") === "custom" && (
                  <FormField
                    control={form.control}
                    name="customScale"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={t("session.customScalePlaceholder")}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <div className="bg-neutral-100 p-3 rounded-md">
                  <div className="text-sm text-muted-foreground mb-2">
                    {t("session.currentScale")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentScale.map((value) => (
                      <span
                        key={value}
                        className="px-3 py-1 bg-white rounded-md shadow-sm"
                      >
                        {value}
                      </span>
                    ))}
                    {currentScale.length === 0 && (
                      <span className="text-sm text-muted-foreground">
                        {t("session.noValidScaleValues")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <FormLabel>{t("session.userStories")}</FormLabel>
                  <Button
                    type="button"
                    variant="link"
                    onClick={addUserStory}
                    className="text-primary hover:text-primary/80 p-0 h-auto"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t("session.addStory")}
                  </Button>
                </div>
                
                {fields.map((field, index) => (
                  <div key={field.id} className="bg-neutral-100 p-4 rounded-md mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-medium">{t("session.userStoryNum", { number: index + 1 })}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => fields.length > 1 && remove(index)}
                        className="text-muted-foreground hover:text-red-500 h-8 w-8 p-0"
                        disabled={fields.length <= 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="mb-3">
                      <FormField
                        control={form.control}
                        name={`userStories.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("session.storyTitle")}</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name={`userStories.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("session.storyDescription")}</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value || ""}
                              rows={2}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
                {form.formState.errors.userStories?.root && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.userStories.root.message}
                  </p>
                )}
              </div>
              
              <FormField
                control={form.control}
                name="notificationsEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>{t("session.notificationsEnabled")}</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter className="flex justify-between items-center">
                <DialogClose asChild>
                  <Button variant="outline" type="button">
                    {t("common.cancel")}
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t("common.loading") : t("session.createButton")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
