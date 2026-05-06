import { Pizza } from "lucide-react";
import { useEmpresaBranding } from "@/contexts/EmpresaBrandingContext";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  iconClassName?: string;
  alt?: string;
}

export function BrandLogo({ className = "h-7 w-7", imageClassName, iconClassName, alt = "Pizza Premiada" }: BrandLogoProps) {
  const { logoUrl } = useEmpresaBranding();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={alt}
        className={cn(className, "shrink-0 rounded-md object-contain", imageClassName)}
      />
    );
  }

  return <Pizza className={cn(className, "shrink-0 text-primary", iconClassName)} />;
}
