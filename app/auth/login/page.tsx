"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { signIn } from "next-auth/react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserRound } from "lucide-react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (values: LoginFormValues) => {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (!result || result.error) {
        throw new Error(result?.error ?? "Unable to login");
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Logged in successfully");
      router.push("/home");
      router.refresh();
    },
    onError: (error: Error) => {
      if (error.message.toLowerCase().includes("not verified")) {
        const email = form.getValues("email");
        if (email) {
          toast.error("Your account is not verified. Please verify your email.");
          router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
          return;
        }
      }

      toast.error(error.message || "Login failed");
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8">
      <div className="relative w-full max-w-[1172px] overflow-hidden rounded-[40px] bg-[rgba(248,250,253,0.6)] shadow-[4px_0px_32px_0px_rgba(0,0,0,0.15)] lg:h-[777.9995px]">
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          <div className="absolute left-0 top-0 h-[777.9995px] w-[696.5px] bg-[#f6f7f9]" style={{ clipPath: "polygon(0 0, 100% 0, 68% 100%, 0 100%)" }} />
          <div className="absolute right-0 top-0 h-[777.9995px] w-[696.5px] bg-[#f6f7f9]" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 32% 100%)" }} />
          <div className="absolute left-4/5 top-0 h-[777.9995px] w-[696.5px] -translate-x-1/2 skew-x-[165deg] bg-[rgba(255,255,255,0.55)] shadow-[-8px_0_22px_rgba(0,0,0,0.08)]" />
        </div>

        <div className="relative z-10 grid h-full lg:grid-cols-2">
          <div className="flex items-center justify-center px-5 py-10 text-center sm:px-10">
            <div className="w-full max-w-[500px]">
              <h1 className="fs-pop-60-bold text-[#090b12]">Welcome Back!</h1>
              <p className="font-poppins mx-auto mt-8 max-w-[430px] text-[22px] leading-[1.2] font-semibold text-[#1f232d]">To keep connected with us please login with your personal info</p>
            </div>
          </div>

          <div className="flex items-center justify-center px-5 py-10 sm:px-10">
            <div className="w-full max-w-[468px]">
              <div className="mb-8 text-center">
                <h2 className="fs-pop-60-bold text-[#090b12]">Login</h2>
                <p className="font-poppins mt-7 text-[20px] font-normal text-[#2f323a]">or use your Username for login</p>
              </div>

              <form className="space-y-[18px]" onSubmit={form.handleSubmit(onSubmit)}>
                <div>
                  <div className="relative">
                    <Input placeholder="Username" {...form.register("email")} className="h-[56px] rounded-[4px] border-[#8f9399] bg-transparent pr-12 font-poppins text-[16px] text-[#2f323a] placeholder:text-[16px] placeholder:text-[#666]" />
                    <UserRound className="pointer-events-none absolute right-4 top-1/2 size-6 -translate-y-1/2 text-[#666]" />
                  </div>
                  {form.formState.errors.email ? <p className="mt-1 text-xs text-red-500">{form.formState.errors.email.message}</p> : null}
                </div>

                <div>
                  <Controller
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <PasswordInput
                        placeholder="Password"
                        className="h-[56px] rounded-[4px] border-[#8f9399] bg-transparent"
                        inputClassName="h-[56px] rounded-[4px] border-[#8f9399] bg-transparent font-poppins text-[16px] text-[#2f323a] placeholder:text-[16px] placeholder:text-[#666]"
                        {...field}
                      />
                    )}
                  />
                  {form.formState.errors.password ? <p className="mt-1 text-xs text-red-500">{form.formState.errors.password.message}</p> : null}
                </div>

                <Link className="font-poppins block text-center text-[20px] font-normal text-[#2f323a] hover:underline" href="/auth/forgot-password">
                  Forget Password?
                </Link>

                <Button type="submit" className="font-poppins h-[56px] w-full rounded-[8px] bg-[#2DAA46] text-[18px] font-medium text-white hover:bg-[#24943a]" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? "Logging in..." : "Login"}
                </Button>

                <p className="font-poppins text-center text-[15px] text-[#5D6473]">
                  New here?{" "}
                  <Link href="/auth/register" className="font-semibold text-[#2DAA46] hover:underline">
                    Create account
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
