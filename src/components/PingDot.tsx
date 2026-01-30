import { cn } from "@/lib/utils";

export default function PingDot({
  className,
  color = "green",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <span className={cn("relative mx-1 inline-flex h-3 w-3", className)}>
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
          color === "green" && "bg-green-400",
          color === "red" && "bg-red-400",
          color === "blue" && "bg-blue-400",
          color === "purple" && "bg-purple-400"
        )}
      ></span>
      <span
        className={cn(
          "relative inline-flex h-3 w-3 rounded-full",
          color === "green" && "bg-green-500",
          color === "red" && "bg-red-500",
          color === "blue" && "bg-blue-500",
          color === "purple" && "bg-[#5048e4]"
        )}
      ></span>
    </span>
  );
}
