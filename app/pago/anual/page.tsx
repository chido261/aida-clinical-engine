import PagoAnualClient from "./pago-anual-client";

type PagoAnualPageProps = {
  searchParams?: Promise<{
    upgrade?: string;
    renew?: string;
    discount?: string;
  }>;
};

export default async function PagoAnualPage({
  searchParams,
}: PagoAnualPageProps) {
  const params = await searchParams;

  return (
    <PagoAnualClient
      isUpgrade={params?.upgrade === "1"}
      isRenewal={params?.renew === "1" || params?.renew === "anual"}
      hasAnnualDiscount={params?.discount === "30"}
    />
  );
}