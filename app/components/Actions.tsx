"use client";

export function OpenLeadButton({ label = "Разобрать мою ситуацию", className = "" }) {
  return (
    <button
      className={`button button--primary ${className}`}
      onClick={() => window.dispatchEvent(new Event("open-lead-dialog"))}
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
  return <OpenLeadButton label="Заказать онлайн" />;
}
