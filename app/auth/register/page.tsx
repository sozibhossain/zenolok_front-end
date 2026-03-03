"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { authApi } from "@/lib/api";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

// Schema updated to match fields visible in the image
const registerSchema = z
  .object({
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6),
    termsAccepted: z
      .boolean()
      .refine((val) => val === true, "Please accept the terms"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      termsAccepted: false,
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data, variables) => {
      toast.success("Registration successful. Check your email.");
      router.push(
        `/auth/verify-email?email=${encodeURIComponent(data?.email || variables.email)}`,
      );
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Registration failed";
      toast.error(message);
    },
  });

  const onSubmit = (values: RegisterFormValues) => {
    const usernameFromEmail = values.email.split("@")[0]?.trim() || values.email.trim();

    registerMutation.mutate({
      username: usernameFromEmail,
      email: values.email,
      password: values.password,
      termsAccepted: values.termsAccepted,
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8">
      <div className="relative w-full max-w-[1172px] overflow-hidden rounded-[40px] bg-[rgba(248,250,253,0.6)] shadow-[4px_0px_32px_0px_rgba(0,0,0,0.15)] lg:h-[777.9995px]">
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          <div className="absolute left-1/5 top-0 h-[777.9995px] w-[696.5px] -translate-x-1/2 -skew-x-[165deg] bg-[rgba(255,255,255,0.55)] shadow-[8px_0_22px_rgba(0,0,0,0.08)]" />
        </div>

        <div className="relative z-10 grid h-full lg:grid-cols-2">
          <div className="flex items-center justify-center px-5 py-10 sm:px-10">
            <div className="w-full max-w-[468px]">
              <div className="mb-8 text-center">
                <h2 className="fs-pop-60-bold text-[#090b12]">Registration</h2>
                <p className="font-poppins mt-7 text-[20px] font-normal text-[#2f323a]">
                  or use your email for registration
                </p>
              </div>

              <form
                className="space-y-[18px]"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <div className="relative">
                  <Input
                    placeholder="Email"
                    {...form.register("email")}
                    className="h-[56px] rounded-[4px] border-[#8f9399] bg-transparent pr-12 font-poppins text-[16px] text-[#2f323a] placeholder:text-[16px] placeholder:text-[#666]"
                  />
                  <Mail className="absolute right-4 top-1/2 size-6 -translate-y-1/2 text-[#666]" />
                  {form.formState.errors.email ? (
                    <p className="mt-1 text-xs text-red-500">
                      {form.formState.errors.email.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <PasswordInput
                    placeholder="Password"
                    {...form.register("password")}
                    className="h-[56px] rounded-[4px] border-[#8f9399] bg-transparent"
                    inputClassName="h-[56px] rounded-[4px] border-[#8f9399] bg-transparent font-poppins text-[16px] text-[#2f323a] placeholder:text-[16px] placeholder:text-[#666]"
                  />
                  {form.formState.errors.password ? (
                    <p className="mt-1 text-xs text-red-500">
                      {form.formState.errors.password.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <PasswordInput
                    placeholder="Confirm Password"
                    {...form.register("confirmPassword")}
                    className="h-[56px] rounded-[4px] border-[#8f9399] bg-transparent"
                    inputClassName="h-[56px] rounded-[4px] border-[#8f9399] bg-transparent font-poppins text-[16px] text-[#2f323a] placeholder:text-[16px] placeholder:text-[#666]"
                  />
                  {form.formState.errors.confirmPassword ? (
                    <p className="mt-1 text-xs text-red-500">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2.5">
                    <Controller
                      control={form.control}
                      name="termsAccepted"
                      render={({ field }) => (
                        <Checkbox
                          id="terms"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="size-[18px] border-[#8f9399] data-[state=checked]:border-[#2DAA46] data-[state=checked]:bg-[#2DAA46]"
                        />
                      )}
                    />
                    <label
                      htmlFor="terms"
                      className="font-poppins text-[15px] text-[#454953]"
                    >
                      I agree to the{" "}
                      <span className="font-medium text-[#2DAA46]">
                        Terms & Condition
                      </span>
                    </label>
                  </div>
                  {form.formState.errors.termsAccepted ? (
                    <p className="text-xs text-red-500">
                      {form.formState.errors.termsAccepted.message}
                    </p>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  className="font-poppins mt-2 h-[56px] w-full rounded-[8px] bg-[#2DAA46] text-[18px] font-medium text-white hover:bg-[#24943a]"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Registering..." : "Register"}
                </Button>
              </form>
            </div>
          </div>

          <div className="flex items-center justify-center px-5 py-10 text-center sm:px-10">
            <div className="w-full max-w-[500px]">
              <h1 className="fs-pop-60-bold text-[#090b12]">Hello, Welcome!</h1>
              <p className="font-poppins mx-auto mt-8 max-w-[430px] text-[22px] leading-[1.2] font-semibold text-[#1f232d]">
                Enter your personal details to use all of site features
              </p>
              <Button
                variant="outline"
                className="font-poppins mt-10 h-[58px] w-[248px] rounded-[10px] border-[#2DAA46] bg-transparent text-[18px] font-medium text-[#2DAA46] hover:bg-[#edf9ef]"
                asChild
              >
                <Link href="/auth/login">Login</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
