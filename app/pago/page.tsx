import PagoClient from "./pago-client";

type PagoPageProps = {
  searchParams?: Promise<{
    upgrade?: string;
    renew?: string;
    discount?: string;
  }>;
};

export default async function PagoPage({ searchParams }: PagoPageProps) {
  const params = await searchParams;

  const mode =
    params?.upgrade === "1"
      ? "upgrade"
      : params?.renew === "anual"
        ? "renewal"
        : "normal";

  return <PagoClient mode={mode} />;
}