import { cn } from "@/lib/utils";

const logoAssets = {
  primary: "/images%20(2)/aegisweb_primary_logo.png",
  inverted: "/images%20(2)/aegisweb_inverted_logo.png",
  standalone: "/images%20(2)/aegisweb_standalone_icon.png",
  square: "/images%20(2)/aegisweb_square_icon.png",
  ios: "/images%20(2)/aegisweb_ios_app_icon.png",
} as const;

type LogoVariant = keyof typeof logoAssets;

const sizeClass: Record<LogoVariant, string> = {
  primary: "h-9 w-40",
  inverted: "h-9 w-40",
  standalone: "size-8",
  square: "size-8",
  ios: "size-8",
};

const fitClass: Record<LogoVariant, string> = {
  primary: "bg-cover",
  inverted: "bg-cover",
  standalone: "bg-contain",
  square: "bg-cover",
  ios: "bg-cover",
};

export function BrandLogo({
  variant = "primary",
  className,
  priority = false,
}: {
  variant?: LogoVariant;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label="AegisWeb"
      data-priority={priority ? "true" : undefined}
      className={cn(
        "inline-block shrink-0 bg-center bg-no-repeat align-middle",
        sizeClass[variant],
        fitClass[variant],
        className,
      )}
      style={{ backgroundImage: `url("${logoAssets[variant]}")` }}
    />
  );
}

export function BrandMark({
  variant = "standalone",
  className,
  priority = false,
}: {
  variant?: Extract<LogoVariant, "standalone" | "square" | "ios">;
  className?: string;
  priority?: boolean;
}) {
  return <BrandLogo variant={variant} className={className} priority={priority} />;
}
