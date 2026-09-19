import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/friendly-error";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Introduza um email válido.")
    .max(255, "O email é demasiado longo."),
  password: z
    .string()
    .min(8, "A palavra-passe deve ter pelo menos 8 caracteres.")
    .max(128, "A palavra-passe é demasiado longa."),
  rememberMe: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

interface AuthFormSplitScreenProps {
  logo: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  onSubmit: (data: LoginFormValues) => Promise<void>;
  forgotPasswordHref: string;
  createAccountHref: string;
}

const itemVariants = {
  hidden: { y: 14, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

export function AuthFormSplitScreen({
  logo,
  eyebrow = "NovaWebinar",
  title,
  description,
  imageSrc,
  imageAlt,
  onSubmit,
  forgotPasswordHref,
  createAccountHref,
}: AuthFormSplitScreenProps) {
  const [submissionError, setSubmissionError] = useState("");
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  async function handleSubmit(data: LoginFormValues) {
    setSubmissionError("");
    try {
      await onSubmit(data);
    } catch (error) {
      setSubmissionError(
        friendlyError(error, "Não foi possível entrar. Tente novamente."),
      );
    }
  }

  const isLoading = form.formState.isSubmitting;

  return (
    <main className="min-h-screen bg-background md:grid md:grid-cols-[minmax(0,0.92fr)_minmax(28rem,1.08fr)]">
      <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 md:px-12 lg:px-20">
        <motion.div
          className="w-full max-w-md"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          <motion.div variants={itemVariants}>{logo}</motion.div>
          <motion.div variants={itemVariants} className="mb-8 mt-10">
            <p className="mb-3 text-xs font-bold uppercase text-primary">{eyebrow}</p>
            <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
          </motion.div>

          <Form {...form}>
            <motion.form
              variants={itemVariants}
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-5"
              noValidate
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        className="h-12"
                        type="email"
                        autoComplete="email"
                        placeholder="nome@empresa.com"
                        disabled={isLoading}
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
                    <div className="flex items-center justify-between gap-4">
                      <FormLabel>Palavra-passe</FormLabel>
                      <a
                        href={forgotPasswordHref}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Esqueceu-se?
                      </a>
                    </div>
                    <FormControl>
                      <Input
                        className="h-12"
                        type="password"
                        autoComplete="current-password"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">
                      Manter sessão iniciada
                    </FormLabel>
                  </FormItem>
                )}
              />
              {submissionError && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {submissionError}
                </p>
              )}
              <Button
                className="h-12 w-full text-base font-semibold"
                type="submit"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="animate-spin" aria-hidden="true" />}
                {isLoading ? "A entrar..." : "Entrar"}
              </Button>
            </motion.form>
          </Form>

          <motion.p
            variants={itemVariants}
            className="mt-7 text-center text-sm text-muted-foreground"
          >
            Ainda não tem conta?{" "}
            <a href={createAccountHref} className="font-semibold text-primary hover:underline">
              Criar conta
            </a>
          </motion.p>
          <motion.p
            variants={itemVariants}
            className="mt-10 text-center text-xs text-muted-foreground"
          >
            Ao continuar, confirma que aceita os termos e a política de privacidade.
          </motion.p>
        </motion.div>
      </section>

      <aside className="relative hidden min-h-screen overflow-hidden md:block">
        <img
          src={imageSrc}
          alt={imageAlt}
          width={1280}
          height={1600}
          className="absolute inset-0 size-full object-cover object-center"
        />
      </aside>
    </main>
  );
}
