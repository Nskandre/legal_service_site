"use client";

export function OpenLeadButton({
  label = "Разобрать мою ситуацию",
  className = "",
  service = "Первичная консультация",
}: {
  label?: string;
  className?: string;
  service?: string;
}) {
  return (
    <button
      className={`button button--primary ${className}`}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("open-lead-dialog", { detail: { service } }),
        )
      }
    >
      {label}
    </button>
  );
}

export function OrderButton({ service }: { service: string }) {
  const paymentUrl = process.env.NEXT_PUBLIC_PAYMENT_URL;
  if (paymentUrl) {
    const separator = paymentUrl.includes("?") ? "&" : "?";
    return (
      <a
        className="button button--primary"
        href={`${paymentUrl}${separator}service=${encodeURIComponent(service)}`}
        rel="nofollow"
      >
        Оплатить онлайн
      </a>
    );
  }
  return <OpenLeadButton label="Заказать онлайн" service={service} />;
}
