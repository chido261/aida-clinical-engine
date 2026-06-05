import PagoTresMesesClient from "./pago-tres-meses-client";

type PagoTresMesesPageProps = {
  searchParams?: Promise<{
    upgrade?: string;
  }>;
};

export default async function PagoTresMesesPage({
  searchParams,
}: PagoTresMesesPageProps) {
  const params = await searchParams;

  return <PagoTresMesesClient isUpgrade={params?.upgrade === "1"} />;
}