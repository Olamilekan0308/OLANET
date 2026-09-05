import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, readFile } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

const compatibilityPlugin = {
  name: "olanet-runtime-compatibility",
  setup(build) {
    build.onResolve({ filter: /^@replit\/connectors-sdk$/ }, () => ({ path: "olanet-replit-connectors-shim", namespace: "olanet-shim" }));
    build.onLoad({ filter: /.*/, namespace: "olanet-shim" }, () => ({
      loader: "js",
      contents: `
        export class ReplitConnectors {
          async proxy(service, path, init = {}) {
            if (service !== "supabase") throw new Error("Unsupported connector service");
            const base = String(process.env.SUPABASE_URL || "").replace(/\\/$/, "");
            const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
            if (!base || !anonKey) throw new Error("Missing SUPABASE_URL or Supabase API key");
            const headers = { apikey: anonKey, ...(init.headers || {}) };
            return fetch(base + path, { ...init, headers });
          }
        }
      `,
    }));
    build.onLoad({ filter: /\.tsx?$/ }, async (args) => {
      const source = await readFile(args.path, "utf8");
      const fixed = source.replace(/Promise<void=>/g, "Promise<void> =>");
      return { contents: fixed, loader: args.path.endsWith(".tsx") ? "tsx" : "ts" };
    });
  },
};

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: [
      "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas", "bcrypt", "argon2", "fsevents", "re2", "farmhash",
      "xxhash-addon", "bufferutil", "utf-8-validate", "ssh2", "cpu-features", "dtrace-provider", "isolated-vm",
      "lightningcss", "pg-native", "oracledb", "mongodb-client-encryption", "nodemailer", "handlebars", "knex",
      "typeorm", "protobufjs", "onnxruntime-node", "@tensorflow/*", "@prisma/client", "@mikro-orm/*", "@grpc/*",
      "@swc/*", "@aws-sdk/*", "@azure/*", "@opentelemetry/*", "@google-cloud/*", "@google/*", "googleapis",
      "firebase-admin", "@parcel/watcher", "@sentry/profiling-node", "@tree-sitter/*", "aws-sdk", "classic-level",
      "dd-trace", "ffi-napi", "grpc", "hiredis", "kerberos", "leveldown", "miniflare", "mysql2", "newrelic",
      "odbc", "piscina", "realm", "ref-napi", "rocksdb", "sass-embedded", "sequelize", "serialport", "snappy",
      "tinypool", "usb", "workerd", "wrangler", "zeromq", "zeromq-prebuilt", "playwright", "puppeteer",
      "puppeteer-core", "electron",
    ],
    sourcemap: "linked",
    plugins: [
      compatibilityPlugin,
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
