# AIDA Clinical Engine – Estado Actual

## Arquitectura
- Next.js (App Router)
- Prisma + SQLite
- API: /api/chat/route.ts
- Prompt central: app/lib/aidaPrompt.ts
- Motor de reglas: aidaRules.ts
- Memoria: aidaMemory.ts

## Estado actual
- Formato obligatorio cuando exista progreso activo
- Tendencia usa verbo en pasado (Bajó/Subió/Estable)
- No se usan números negativos visibles
- No se usa la palabra "baseline"
- Cambio expresado como: "desde tu punto de inicio"

## Próximo objetivo
- Interpretación automática de HbA1c
- Sistema de riesgo por rangos
- Optimización de token usage