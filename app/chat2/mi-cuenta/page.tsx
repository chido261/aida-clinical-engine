// app/chat2/mi-cuenta/page.tsx

"use client";

import { useEffect, useState } from "react";
import { getDeviceId } from "@/app/lib/deviceId";

type AllowedPhase = "DIAGNOSTICO" | "FASE_1" | "FASE_2";

type PhaseOption = {
  value: AllowedPhase;
  label: string;
};

type Chat2Account = {
  id: string;

  personal: {
    name: string | null;
    age: number | null;
    heightCm: number | null;
    heightMeters: number | null;
    weightKg: number | null;
    diagnosis: string | null;
  };

  clinical: {
    baselineA1c: number | null;
    medications: string | null;

    fastingReferenceMgDl: number | null;
    fastingMinimumMgDl: number | null;
    fastingMaximumMgDl: number | null;
    fastingAverageMgDl: number | null;

    postMealReferenceMgDl: number | null;
    postMealMinimumMgDl: number | null;
    postMealMaximumMgDl: number | null;
    postMealAverageMgDl: number | null;
  };

  protocol: {
    activePhase: AllowedPhase;
    activePhaseLabel: string;
    activeProtocol: string;
    protocolStartedAt: string | null;
    eligibleForNextProtocol: boolean;
    protocolReviewReason: string | null;
    availablePhases: PhaseOption[];
  };

  updatedAt: string;
};

type AccountResponse =
  | {
      ok: true;
      account: Chat2Account;
      message?: string | null;
    }
  | {
      ok: false;
      error?: string;
      message?: string;
    };

type ProfileForm = {
  name: string;
  age: string;
  heightCm: string;
  weightKg: string;
  baselineA1c: string;
  meds: string;
  fastingPeakMgDl: string;
  postMealPeakMgDl: string;
};

function safeString(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function formatValue(
  value: number | string | null,
  suffix = "No disponible"
) {
  if (value === null || value === "") {
    return suffix;
  }

  return String(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No disponible";
  }

  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "No disponible";
  }
}

function diagnosisLabel(value: string | null) {
  if (value === "dm2") {
    return "Diabetes tipo 2";
  }

  if (value === "prediabetes") {
    return "Prediabetes";
  }

  if (value === "other") {
    return "Otro";
  }

  return "No registrado";
}

function buildProfileForm(account: Chat2Account): ProfileForm {
  return {
    name: account.personal.name ?? "",
    age: safeString(account.personal.age),
    heightCm: safeString(account.personal.heightCm),
    weightKg: safeString(account.personal.weightKg),
    baselineA1c: safeString(account.clinical.baselineA1c),
    meds: account.clinical.medications ?? "",
    fastingPeakMgDl: safeString(
      account.clinical.fastingReferenceMgDl
    ),
    postMealPeakMgDl: safeString(
      account.clinical.postMealReferenceMgDl
    ),
  };
}

function FieldCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | string | null;
  unit?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 14,
        background: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "#6b7280",
          marginBottom: 6,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: "#111827",
        }}
      >
        {value === null || value === ""
          ? "No disponible"
          : `${value}${unit ? ` ${unit}` : ""}`}
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  step,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "#374151",
        }}
      >
        {label}
      </span>

      <input
        type={type}
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid #d1d5db",
          borderRadius: 12,
          padding: "10px 12px",
          fontSize: 15,
          color: "#111827",
          background: "#ffffff",
          outline: "none",
        }}
      />
    </label>
  );
}

export default function Chat2MiCuentaPage() {
  const [deviceId, setDeviceId] = useState("");
  const [account, setAccount] = useState<Chat2Account | null>(null);

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: "",
    age: "",
    heightCm: "",
    weightKg: "",
    baselineA1c: "",
    meds: "",
    fastingPeakMgDl: "",
    postMealPeakMgDl: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    if (!deviceId) {
      return;
    }

    void loadAccount();
  }, [deviceId]);

  async function requestAccount(
    payload: Record<string, unknown>
  ): Promise<AccountResponse> {
    const response = await fetch("/api/chat2/account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId,
        ...payload,
      }),
    });

    const data = (await response.json()) as AccountResponse;

    if (!response.ok || !data.ok) {
      throw new Error(
        data.ok
          ? "No se pudo completar la operación."
          : data.message ||
              data.error ||
              "No se pudo completar la operación."
      );
    }

    return data;
  }

  function applyAccountData(nextAccount: Chat2Account) {
    setAccount(nextAccount);
    setProfileForm(buildProfileForm(nextAccount));
  }

  async function loadAccount() {
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const data = await requestAccount({
        action: "GET_ACCOUNT",
      });

      if (data.ok) {
        applyAccountData(data.account);
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar Mi cuenta."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function saveProfile() {
    if (!deviceId || isSavingProfile) {
      return;
    }

    setIsSavingProfile(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const data = await requestAccount({
        action: "UPDATE_PROFILE",
        name: profileForm.name,
        age: profileForm.age,
        heightCm: profileForm.heightCm,
        weightKg: profileForm.weightKg,
        baselineA1c: profileForm.baselineA1c,
        meds: profileForm.meds,
        fastingPeakMgDl: profileForm.fastingPeakMgDl,
        postMealPeakMgDl: profileForm.postMealPeakMgDl,
      });

      if (data.ok) {
        applyAccountData(data.account);
        setSuccessMessage(
          data.message || "El perfil fue actualizado correctamente."
        );
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el perfil."
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 820,
        minHeight: "100vh",
        margin: "0 auto",
        padding: 16,
        background: "#f8fafc",
        color: "#111827",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 950,
              margin: 0,
            }}
          >
            Mi cuenta
          </h1>

          <p
            style={{
              margin: "5px 0 0",
              color: "#6b7280",
              fontSize: 14,
            }}
          >
            Consulta y modifica la información usada por AIDA2.
          </p>
        </div>

        <a
          href="/chat2"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #d1d5db",
            borderRadius: 999,
            padding: "9px 13px",
            background: "#ffffff",
            color: "#111827",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 850,
            whiteSpace: "nowrap",
          }}
        >
          Volver a Chat2
        </a>
      </header>

      {isLoading ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
            padding: 18,
            fontWeight: 750,
            color: "#4b5563",
          }}
        >
          Cargando información...
        </div>
      ) : null}

      {errorMessage ? (
        <div
          style={{
            border: "1px solid #fecaca",
            borderRadius: 14,
            background: "#fef2f2",
            color: "#991b1b",
            padding: 14,
            marginBottom: 14,
            fontSize: 14,
            fontWeight: 750,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div
          style={{
            border: "1px solid #bbf7d0",
            borderRadius: 14,
            background: "#f0fdf4",
            color: "#166534",
            padding: 14,
            marginBottom: 14,
            fontSize: 14,
            fontWeight: 750,
          }}
        >
          {successMessage}
        </div>
      ) : null}

      {!isLoading && account ? (
        <>
          <section
            style={{
              border: "1px solid #bfdbfe",
              borderRadius: 18,
              background: "#eff6ff",
              padding: 18,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: "#1d4ed8",
                marginBottom: 5,
              }}
            >
              Fase actual de asesoría
            </div>

            <div
              style={{
                fontSize: 23,
                fontWeight: 950,
                color: "#111827",
                marginBottom: 5,
              }}
            >
              {account.protocol.activePhaseLabel}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#4b5563",
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              Chat2 utilizará el protocolo correspondiente a esta fase
              cuando analice alimentos y construya recomendaciones.
            </div>

            <div
              style={{
                borderRadius: 12,
                padding: "11px 12px",
                background: "#eff6ff",
                color: "#1e3a8a",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              La fase se actualiza automáticamente de acuerdo con tu plan,
              tus mediciones y los criterios del protocolo.
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Protocolo interno:{" "}
              <strong>{account.protocol.activeProtocol}</strong>
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Inicio de fase:{" "}
              <strong>
                {formatDate(account.protocol.protocolStartedAt)}
              </strong>
            </div>
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 18,
              background: "#ffffff",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 950,
                margin: "0 0 14px",
              }}
            >
              Datos actuales
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(155px, 1fr))",
                gap: 10,
              }}
            >
              <FieldCard
                label="Nombre"
                value={account.personal.name}
              />

              <FieldCard
                label="Edad"
                value={account.personal.age}
                unit="años"
              />

              <FieldCard
                label="Estatura"
                value={account.personal.heightMeters}
                unit="m"
              />

              <FieldCard
                label="Peso"
                value={account.personal.weightKg}
                unit="kg"
              />

              <FieldCard
                label="Diagnóstico"
                value={diagnosisLabel(
                  account.personal.diagnosis
                )}
              />

              <FieldCard
                label="Hemoglobina glucosilada"
                value={account.clinical.baselineA1c}
                unit="%"
              />
            </div>
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 18,
              background: "#ffffff",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 950,
                margin: "0 0 14px",
              }}
            >
              Glucosa
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 10,
              }}
            >
              <FieldCard
                label="Promedio en ayunas"
                value={
                  account.clinical.fastingAverageMgDl
                }
                unit="mg/dL"
              />

              <FieldCard
                label="Ayuno más bajo"
                value={
                  account.clinical.fastingMinimumMgDl
                }
                unit="mg/dL"
              />

              <FieldCard
                label="Ayuno más alto"
                value={
                  account.clinical.fastingMaximumMgDl
                }
                unit="mg/dL"
              />

              <FieldCard
                label="Promedio postcomida"
                value={
                  account.clinical.postMealAverageMgDl
                }
                unit="mg/dL"
              />

              <FieldCard
                label="Postcomida más baja"
                value={
                  account.clinical.postMealMinimumMgDl
                }
                unit="mg/dL"
              />

              <FieldCard
                label="Postcomida más alta"
                value={
                  account.clinical.postMealMaximumMgDl
                }
                unit="mg/dL"
              />
            </div>
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 18,
              background: "#ffffff",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 950,
                margin: "0 0 14px",
              }}
            >
              Editar perfil
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 12,
              }}
            >
              <FormField
                label="Nombre"
                value={profileForm.name}
                onChange={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    name: value,
                  }))
                }
              />

              <FormField
                label="Edad"
                type="number"
                min="18"
                max="120"
                value={profileForm.age}
                onChange={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    age: value,
                  }))
                }
              />

              <FormField
                label="Estatura en centímetros"
                type="number"
                step="0.1"
                min="100"
                max="250"
                value={profileForm.heightCm}
                onChange={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    heightCm: value,
                  }))
                }
              />

              <FormField
                label="Peso en kilogramos"
                type="number"
                step="0.1"
                min="30"
                max="400"
                value={profileForm.weightKg}
                onChange={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    weightKg: value,
                  }))
                }
              />

              <FormField
                label="Hemoglobina glucosilada"
                type="number"
                step="0.1"
                min="3"
                max="25"
                value={profileForm.baselineA1c}
                onChange={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    baselineA1c: value,
                  }))
                }
              />

              <FormField
                label="Glucosa promedio o referencia en ayunas"
                type="number"
                min="30"
                max="600"
                value={profileForm.fastingPeakMgDl}
                onChange={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    fastingPeakMgDl: value,
                  }))
                }
              />

              <FormField
                label="Glucosa promedio o referencia postcomida"
                type="number"
                min="30"
                max="600"
                value={profileForm.postMealPeakMgDl}
                onChange={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    postMealPeakMgDl: value,
                  }))
                }
              />
            </div>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 12,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 850,
                  color: "#374151",
                }}
              >
                Medicamentos
              </span>

              <textarea
                value={profileForm.meds}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    meds: event.target.value,
                  }))
                }
                rows={4}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  resize: "vertical",
                  border: "1px solid #d1d5db",
                  borderRadius: 12,
                  padding: "11px 12px",
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: "#111827",
                  background: "#ffffff",
                  outline: "none",
                }}
              />
            </label>

            <button
              type="button"
              onClick={saveProfile}
              disabled={isSavingProfile}
              style={{
                marginTop: 14,
                border: "none",
                borderRadius: 12,
                padding: "11px 16px",
                background: isSavingProfile
                  ? "#9ca3af"
                  : "#111827",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 900,
                cursor: isSavingProfile
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {isSavingProfile
                ? "Guardando..."
                : "Guardar perfil"}
            </button>
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 18,
              background: "#ffffff",
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 950,
                margin: "0 0 8px",
              }}
            >
              Medicamentos actuales
            </h2>

            <div
              style={{
                color: "#374151",
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {formatValue(
                account.clinical.medications,
                "No hay medicamentos registrados."
              )}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
