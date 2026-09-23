"use client";

export function OpenLeadButton({
  label = "Разобрать мою ситуацию",
  className = "",
  service = "Первичная консультация",
  submitLabel,
}: {
  label?: string;
  className?: string;
  service?: string;
  submitLabel?: string;
}) {
  return (
    <button
      className={`button button--primary ${className}`}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("open-lead-dialog", { detail: { service, submitLabel } }),
        )
      }
    >
      {label}
    </button>
  );
}

export function OrderButton({ service }: { service: string }) {
  return <OpenLeadButton label="Задать вопрос" service={service} submitLabel="Отправить вопрос" />;
}

export function OpenBookingButton({ className = "" }: { className?: string }) {
  return (
    <button
      className={`button button--primary ${className}`}
      onClick={() => window.dispatchEvent(new CustomEvent("open-booking-dialog"))}
    >
      Записаться на консультацию
    </button>
  );
}
