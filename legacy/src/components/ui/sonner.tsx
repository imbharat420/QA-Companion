import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#12151E] group-[.toaster]:text-[#F3F4F6] group-[.toaster]:border-white/15 group-[.toaster]:shadow-2xl group-[.toaster]:shadow-black/70 font-sans text-xs",
          description: "group-[.toast]:text-[#9CA3AF]",
          actionButton:
            "group-[.toast]:bg-[#00F2FE] group-[.toast]:text-[#03252B] font-semibold",
          cancelButton:
            "group-[.toast]:bg-white/10 group-[.toast]:text-[#F3F4F6]",
        },
      }}
      {...props}
    />
  );
}
