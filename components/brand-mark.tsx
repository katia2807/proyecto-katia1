/** Marca del programa, cuadrada para distinguirla del avatar circular de la cuenta. */
export function BrandMark({ size = "small" }: { size?: "small" | "large" }) {
  return (
    <span aria-hidden="true" className={`menu-orb flex shrink-0 items-center justify-center rounded-[8px] font-semibold text-white ${size === "large" ? "size-12 text-lg" : "size-8 text-xs"}`}>
      K
    </span>
  );
}
