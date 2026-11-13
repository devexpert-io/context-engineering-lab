// Cuánto ocupan las definiciones de herramientas de cada servidor: conecta como cliente MCP,
// pide tools/list y cuenta herramientas y bytes del JSON que el agente tendría que cargar.
//   LAB_SERVIDORES=<carpeta con node_modules de los servidores> node prueba0/definiciones.ts
import { Client } from "../club/node_modules/@modelcontextprotocol/client/dist/index.mjs";
import { StdioClientTransport } from "../club/node_modules/@modelcontextprotocol/client/dist/stdio.mjs";
import { StreamableHTTPClientTransport } from "../club/node_modules/@modelcontextprotocol/client/dist/index.mjs";
import { writeFileSync } from "node:fs";

const servidores = process.env.LAB_SERVIDORES!;
const lab = import.meta.dirname + "/..";
const SERVIDORES: Record<string, { command?: string; args?: string[]; url?: string; env?: Record<string, string> }> = {
  club: { command: "node", args: [`${lab}/club/src/mcp.ts`], env: { CLUB_API: "http://127.0.0.1:9" } },
  playwright: { command: "node", args: [`${servidores}/node_modules/@playwright/mcp/cli.js`] },
  "chrome-devtools": { command: "node", args: [`${servidores}/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js`] },
  context7: { url: "https://mcp.context7.com/mcp" },
};

const resultado: Record<string, unknown> = {};
for (const [nombre, s] of Object.entries(SERVIDORES)) {
  const cliente = new Client({ name: "definiciones", version: "1.0.0" });
  const transporte = s.url
    ? new StreamableHTTPClientTransport(new URL(s.url))
    : new StdioClientTransport({ command: s.command!, args: s.args, env: { ...process.env, ...s.env } as Record<string, string> });
  await cliente.connect(transporte);
  const { tools } = await cliente.listTools();
  const json = JSON.stringify(tools);
  resultado[nombre] = {
    version: cliente.getServerVersion(),
    herramientas: tools.length,
    bytes: Buffer.byteLength(json),
    bytes_nombres_y_descripciones: Buffer.byteLength(JSON.stringify(tools.map((t) => ({ name: t.name, description: t.description })))),
    instrucciones_bytes: Buffer.byteLength(cliente.getInstructions() ?? ""),
    nombres: tools.map((t) => t.name),
  };
  console.log(nombre, tools.length, "herramientas,", Buffer.byteLength(json), "bytes");
  await cliente.close();
}
writeFileSync(`${import.meta.dirname}/definiciones.json`, JSON.stringify(resultado, null, 1));
