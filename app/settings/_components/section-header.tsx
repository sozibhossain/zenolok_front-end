import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description: string;
  titleClassName?: string;
}

export function SectionHeader({ title, description, titleClassName }: SectionHeaderProps) {
  return (
    <div>
      <h2
        className={cn(
          "font-poppins mb-4 text-[24px] leading-[120%] font-semibold text-[#202531]",
          titleClassName,
        )}
      >
        {title}
      </h2>
      <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">{description}</p>
    </div>
  );
}
