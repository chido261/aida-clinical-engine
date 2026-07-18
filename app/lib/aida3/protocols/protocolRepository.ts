import fs from "node:fs";
import path from "node:path";
import type { ProtocolDocument, ProtocolId, ProtocolPhase } from "./contracts";
import {
  parseFoodCatalog,
  parseOperationalConfig,
  parsePolicyCatalog,
  parseProtocolSections,
} from "./markdownProtocolParser";

const PROTOCOLS: Record<ProtocolId, { name: string; file: string; phase: ProtocolPhase }> = {
  DIAGNOSTICO_7_DIAS: { name: "Fase Diagnóstico 7 días", file: "docs/protocols/diagnostico_7_dias.md", phase: "DIAGNOSTICO" },
  FASE_1: { name: "Fase 1 - Vencer los Antojos", file: "docs/protocols/fase1.md", phase: "FASE_1" },
  FASE_2: { name: "Fase 2 - Reeducar Células Grasas y Fortalecer el Páncreas", file: "docs/protocols/fase2.md", phase: "FASE_2" },
};

export class ProtocolRepository {
  private readonly cache = new Map<ProtocolId, ProtocolDocument>();
  constructor(private readonly rootDirectory = process.cwd()) {}

  get(protocolId: ProtocolId): ProtocolDocument {
    const cached = this.cache.get(protocolId);
    if (cached) return cached;
    const definition = PROTOCOLS[protocolId];
    const absolutePath = path.join(this.rootDirectory, definition.file);
    if (!fs.existsSync(absolutePath)) throw new Error(`No se encontró el protocolo ${protocolId}: ${definition.file}`);
    const sections = parseProtocolSections(fs.readFileSync(absolutePath, "utf8"));
    const operationalText = sections.operationalConfiguration;
    if (!operationalText) throw new Error(`El protocolo ${protocolId} no tiene configuración operativa.`);
    const protocol: ProtocolDocument = Object.freeze({
      id: protocolId, name: definition.name, sourceFile: definition.file,
      sections: Object.freeze({ ...sections }),
      operational: parseOperationalConfig(operationalText, definition.phase),
      foods: Object.freeze(parseFoodCatalog(sections)),
      policies: Object.freeze(parsePolicyCatalog(sections)),
    });
    this.cache.set(protocolId, protocol);
    return protocol;
  }

  clearCache() { this.cache.clear(); }
}
