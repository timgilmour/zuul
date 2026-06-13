/**
 * comfyui - ComfyUI backend for zuul
 *
 * Self-contained module: pure helpers, HTTP client, and orchestrator.
 * Imported by generate-image.ts when --provider comfyui is selected.
 */

// ============================================================================
// Shared Types
// ============================================================================

export type GeminiSize = "512px" | "1K" | "2K" | "4K";
export type AspectRatio = "1:1" | "1:4" | "1:8" | "2:3" | "3:2" | "3:4" | "4:1" | "4:3" | "4:5" | "5:4" | "8:1" | "9:16" | "16:9" | "21:9";

export interface Dimensions { width: number; height: number; }

export type ComfyNode = { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } };
export type ComfyWorkflow = Record<string, ComfyNode>;

export interface InjectParams { positive: string; negative?: string; seed?: number; width?: number; height?: number; steps?: number; cfg?: number; sampler?: string; scheduler?: string; }

export interface Txt2ImgOpts {
  checkpoint: string;
  positive: string;
  negative?: string;
  width: number;
  height: number;
  seed?: number;
  steps?: number;   // default 20
  cfg?: number;     // default 7
  sampler?: string; // default "euler"
  scheduler?: string; // default "normal"
}

export class ComfyUIError extends Error {}

// ============================================================================
// Task 1: Size → dimensions helper
// ============================================================================

const LONG_EDGE: Record<GeminiSize, number> = { "512px": 512, "1K": 1024, "2K": 1536, "4K": 2048 };

const snap8 = (n: number): number => Math.max(8, Math.round(n / 8) * 8);

export function comfySizeToDimensions(size: GeminiSize, aspectRatio: AspectRatio): Dimensions {
  const long = LONG_EDGE[size];
  const [w, h] = aspectRatio.split(":").map(Number);
  let width: number, height: number;
  if (w >= h) { width = long; height = (long * h) / w; }
  else { height = long; width = (long * w) / h; }
  return { width: snap8(width), height: snap8(height) };
}

// ============================================================================
// Task 2: txt2img workflow builder
// ============================================================================

export function buildTxt2ImgWorkflow(o: Txt2ImgOpts): ComfyWorkflow {
  return {
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: o.checkpoint } },
    "5": { class_type: "EmptyLatentImage", inputs: { width: o.width, height: o.height, batch_size: 1 } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: o.positive, clip: ["4", 1] }, _meta: { title: "positive" } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: o.negative ?? "", clip: ["4", 1] }, _meta: { title: "negative" } },
    "3": { class_type: "KSampler", inputs: {
      seed: o.seed ?? 0, steps: o.steps ?? 20, cfg: o.cfg ?? 7,
      sampler_name: o.sampler ?? "euler", scheduler: o.scheduler ?? "normal", denoise: 1,
      model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0],
    } },
    "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: "zuul", images: ["8", 0] } },
  };
}

// ============================================================================
// Task 2b: FLUX.2 txt2img workflow builder
// ============================================================================

export interface Flux2Opts {
  unet: string;
  clip: string;
  vae: string;
  positive: string;
  width: number;
  height: number;
  seed?: number;
  steps?: number;        // default 4 (klein is distilled to 4 steps)
  sampler?: string;      // default "euler"
  references?: string[]; // server-side filenames, already uploaded (see Task 2)
}

export function buildFlux2Workflow(o: Flux2Opts): ComfyWorkflow {
  const steps = o.steps ?? 4;
  const sampler = o.sampler ?? "euler";
  const wf: ComfyWorkflow = {
    "1": { class_type: "UNETLoader", inputs: { unet_name: o.unet, weight_dtype: "default" } },
    "2": { class_type: "CLIPLoader", inputs: { clip_name: o.clip, type: "flux2" } },
    "3": { class_type: "VAELoader", inputs: { vae_name: o.vae } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: o.positive, clip: ["2", 0] }, _meta: { title: "positive" } },
    "5": { class_type: "EmptyFlux2LatentImage", inputs: { width: o.width, height: o.height, batch_size: 1 } },
    "7": { class_type: "KSamplerSelect", inputs: { sampler_name: sampler } },
    "8": { class_type: "Flux2Scheduler", inputs: { steps, width: o.width, height: o.height } },
    "9": { class_type: "RandomNoise", inputs: { noise_seed: o.seed ?? 0 } },
    "11": { class_type: "VAEDecode", inputs: { samples: ["10", 0], vae: ["3", 0] } },
    "12": { class_type: "SaveImage", inputs: { filename_prefix: "zuul", images: ["11", 0] } },
  };

  // Reference chain (Task 2). With no references this leaves cond at the base encode.
  let cond: [string, number] = ["4", 0];
  let next = 100;
  for (const ref of o.references ?? []) {
    const load = String(next++), enc = String(next++), reflat = String(next++);
    wf[load] = { class_type: "LoadImage", inputs: { image: ref } };
    wf[enc] = { class_type: "VAEEncode", inputs: { pixels: [load, 0], vae: ["3", 0] } };
    wf[reflat] = { class_type: "ReferenceLatent", inputs: { conditioning: cond, latent: [enc, 0] } };
    cond = [reflat, 0];
  }

  wf["6"] = { class_type: "BasicGuider", inputs: { model: ["1", 0], conditioning: cond } };
  wf["10"] = { class_type: "SamplerCustomAdvanced", inputs: {
    noise: ["9", 0], guider: ["6", 0], sampler: ["7", 0], sigmas: ["8", 0], latent_image: ["5", 0],
  } };
  return wf;
}

// ============================================================================
// Task 3: Architecture detection + kv predicate
// ============================================================================

export type ComfyArch = "sd" | "flux2";

export const isKvModel = (name: string): boolean => /-kv-fp8/i.test(name);

export function detectComfyArch(
  modelName: string,
  lists: { checkpoints: string[]; diffusionModels: string[] },
  override?: ComfyArch,
): ComfyArch {
  if (override) return override;
  const inCkpt = lists.checkpoints.includes(modelName);
  const inUnet = lists.diffusionModels.includes(modelName);
  if (inCkpt && inUnet) {
    throw new ComfyUIError(`Model "${modelName}" exists in both checkpoints and diffusion_models — pass --comfyui-arch sd|flux2 to disambiguate.`);
  }
  if (inCkpt) return "sd";
  if (inUnet) {
    if (/flux\.?-?2|klein/i.test(modelName)) return "flux2";
    throw new ComfyUIError(`"${modelName}" is a diffusion model but not a recognized FLUX.2 build. Only FLUX.2 is supported; pass --comfyui-arch flux2 to force.`);
  }
  throw new ComfyUIError(
    `Model "${modelName}" not found. checkpoints: [${lists.checkpoints.join(", ")}]; diffusion_models: [${lists.diffusionModels.join(", ")}].`,
  );
}

// ============================================================================
// Task 4: FLUX.2 component resolution (clip/vae defaults)
// ============================================================================

export interface Flux2ModelResolution { unet: string; clip: string; vae: string; }

export function resolveFlux2Models(
  opts: { unet?: string; clip?: string; vae?: string },
  discovered: { clips: string[]; vaes: string[] },
): Flux2ModelResolution {
  const unet = opts.unet;
  if (!unet) throw new ComfyUIError("FLUX.2 requires a diffusion model — pass --comfyui-model or --comfyui-unet.");
  const clip = opts.clip ?? (discovered.clips.length === 1 ? discovered.clips[0] : undefined);
  if (!clip) throw new ComfyUIError(`Could not auto-pick a FLUX.2 text encoder (found: ${discovered.clips.join(", ") || "none"}); pass --comfyui-clip.`);
  const vae = opts.vae
    ?? discovered.vaes.find((v) => /flux2-vae/i.test(v))
    ?? (discovered.vaes.length === 1 ? discovered.vaes[0] : undefined);
  if (!vae) throw new ComfyUIError(`Could not auto-pick a VAE (found: ${discovered.vaes.join(", ") || "none"}); pass --comfyui-vae.`);
  return { unet, clip, vae };
}

// ============================================================================
// Task 5: Workflow injection (the crux)
// ============================================================================

function findByTitle(wf: ComfyWorkflow, needle: string): string | undefined {
  return Object.keys(wf).find(
    (id) => wf[id].class_type.includes("CLIPTextEncode") &&
            (wf[id]._meta?.title ?? "").toLowerCase().startsWith(needle),
  );
}

function traceFromSampler(wf: ComfyWorkflow, slot: "positive" | "negative"): string | undefined {
  const samplers = Object.values(wf).filter((n) => n.class_type.includes("KSampler") || n.class_type.includes("SamplerCustom"));
  if (samplers.length !== 1) return undefined;
  const ref = samplers[0].inputs[slot];
  return Array.isArray(ref) ? String(ref[0]) : undefined;
}

// Custom-sampler graphs hide the prompt behind a guider: BasicGuider exposes a single
// `conditioning`, CFGGuider exposes `positive`/`negative`. From the guider's slot, walk back
// through any chain of ReferenceLatent / FluxGuidance nodes (which re-expose `conditioning`)
// to the source CLIPTextEncode. Returns its id, or undefined if there isn't exactly one
// guider or the chain doesn't end at a text encode.
function traceFromGuider(wf: ComfyWorkflow, slot: "positive" | "negative"): string | undefined {
  const guiders = Object.values(wf).filter((n) => n.class_type.includes("Guider"));
  if (guiders.length !== 1) return undefined;
  const g = guiders[0];
  // CFGGuider has positive/negative; BasicGuider has only `conditioning` (positive prompt).
  let ref: unknown = g.inputs[slot] ?? (slot === "positive" ? g.inputs.conditioning : undefined);
  const seen = new Set<string>();
  while (Array.isArray(ref)) {
    const id = String(ref[0]);
    if (seen.has(id) || !wf[id]) return undefined;
    seen.add(id);
    if (wf[id].class_type.includes("CLIPTextEncode")) return id;
    ref = wf[id].inputs.conditioning; // step back through ReferenceLatent / FluxGuidance
  }
  return undefined;
}

export function injectIntoWorkflow(wf: ComfyWorkflow, p: InjectParams): ComfyWorkflow {
  const out: ComfyWorkflow = structuredClone(wf);

  const posId = findByTitle(out, "positive") ?? traceFromSampler(out, "positive") ?? traceFromGuider(out, "positive");
  if (!posId || !out[posId]) {
    throw new ComfyUIError(
      "Could not locate the positive-prompt node in this workflow. " +
      "Title the node 'positive' in ComfyUI, or use a single-KSampler / single-guider workflow.",
    );
  }
  out[posId].inputs.text = p.positive;

  if (p.negative !== undefined) {
    const negId = findByTitle(out, "negative") ?? traceFromSampler(out, "negative") ?? traceFromGuider(out, "negative");
    if (negId && out[negId]) out[negId].inputs.text = p.negative;
  }

  if (p.seed !== undefined) {
    for (const n of Object.values(out)) {
      if (typeof n.inputs.seed === "number") n.inputs.seed = p.seed;
      if (typeof n.inputs.noise_seed === "number") n.inputs.noise_seed = p.seed;
    }
  }
  if (p.width !== undefined && p.height !== undefined) {
    for (const n of Object.values(out)) {
      if (n.class_type === "EmptyLatentImage" || n.class_type === "EmptyFlux2LatentImage") {
        n.inputs.width = p.width; n.inputs.height = p.height;
      }
      if (n.class_type === "Flux2Scheduler") {
        n.inputs.width = p.width; n.inputs.height = p.height;
      }
    }
  }
  if (p.steps !== undefined) {
    for (const n of Object.values(out)) {
      if (typeof n.inputs.steps === "number") n.inputs.steps = p.steps;
    }
  }
  if (p.cfg !== undefined) {
    for (const n of Object.values(out)) {
      if (typeof n.inputs.cfg === "number") n.inputs.cfg = p.cfg;
    }
  }
  if (p.sampler !== undefined) {
    for (const n of Object.values(out)) {
      if (typeof n.inputs.sampler_name === "string") n.inputs.sampler_name = p.sampler;
    }
  }
  if (p.scheduler !== undefined) {
    for (const n of Object.values(out)) {
      if (typeof n.inputs.scheduler === "string") n.inputs.scheduler = p.scheduler;
    }
  }
  return out;
}

// ============================================================================
// Task 6: GUI (graph) format → API (prompt) format converter
// ============================================================================

type GuiNode = { id: number; type: string; inputs?: Array<{ name: string; link: number | null }>; widgets_values?: unknown[] | Record<string, unknown> };
type GuiWorkflow = { nodes: GuiNode[]; links?: Array<[number, number, number, number, number, string]>; definitions?: { subgraphs?: Array<{ id?: string }> } };
type NodeInputDef = [unknown, ...unknown[]];
type ObjectInfo = Record<string, { input: { required?: Record<string, NodeInputDef>; optional?: Record<string, NodeInputDef> }; input_order?: { required?: string[]; optional?: string[] } }>;

// Annotation-only nodes: drop them — they never participate in execution
// (ComfyUI's own graph→prompt omits them), so a workflow with notes is valid.
const SKIP_GUI_NODES = new Set(["Note", "MarkdownNote", "Note (rgthree)"]);
// Nodes that DO affect data flow and can't be naively converted (they reroute or
// inject values), so converting them silently would corrupt the graph — reject.
const UNSUPPORTED_GUI_NODES = new Set(["Reroute", "Reroute (rgthree)", "PrimitiveNode"]);

export function isGuiWorkflow(wf: unknown): wf is GuiWorkflow {
  return !!wf && typeof wf === "object" && Array.isArray((wf as any).nodes);
}

function isWidgetInput(def: NodeInputDef): boolean {
  const t = def[0];
  if (Array.isArray(t)) return true; // combo / enum (legacy object_info shape: [[...options]])
  // Newer object_info names primitive/combo widgets by string ("COMBO" + {options}).
  return t === "COMBO" || t === "INT" || t === "FLOAT" || t === "STRING" || t === "BOOLEAN";
}

export function guiWorkflowToApi(gui: GuiWorkflow, objectInfo: ObjectInfo): ComfyWorkflow {
  if (!isGuiWorkflow(gui)) throw new ComfyUIError("guiWorkflowToApi: expected a GUI-format workflow with a 'nodes' array.");
  const linkMap = new Map<number, [string, number]>();
  for (const l of gui.links ?? []) linkMap.set(l[0], [String(l[1]), l[2]]);

  const subgraphIds = new Set((gui.definitions?.subgraphs ?? []).map((s) => s.id).filter(Boolean) as string[]);
  const out: ComfyWorkflow = {};
  for (const node of gui.nodes) {
    if (SKIP_GUI_NODES.has(node.type)) continue; // annotation node — not part of execution
    if (UNSUPPORTED_GUI_NODES.has(node.type)) {
      throw new ComfyUIError(`guiWorkflowToApi: node "${node.type}" (id ${node.id}) is unsupported. Re-export without reroute/primitive nodes, or use the agentic /zuul-comfy path.`);
    }
    if (subgraphIds.has(node.type)) {
      throw new ComfyUIError(`guiWorkflowToApi: node ${node.id} is a subgraph ("${node.type}"), which isn't supported yet. In ComfyUI, right-click the subgraph → "Convert to Nodes" and re-save, use a bundled zuul template, or use the agentic /zuul-comfy path.`);
    }
    const def = objectInfo[node.type];
    if (!def) throw new ComfyUIError(`guiWorkflowToApi: node "${node.type}" (id ${node.id}) is not in /object_info (unknown or subgraph node).`);

    const inputs: Record<string, unknown> = {};
    const linked = new Set<string>();
    for (const inp of node.inputs ?? []) {
      if (inp.link != null && linkMap.has(inp.link)) { inputs[inp.name] = linkMap.get(inp.link); linked.add(inp.name); }
    }

    const defs = { ...(def.input.required ?? {}), ...(def.input.optional ?? {}) };
    const order = [
      ...(def.input_order?.required ?? Object.keys(def.input.required ?? {})),
      ...(def.input_order?.optional ?? Object.keys(def.input.optional ?? {})),
    ];
    const wv = node.widgets_values;
    if (Array.isArray(wv)) {
      let wi = 0;
      for (const name of order) {
        const d = defs[name];
        if (!d || !isWidgetInput(d)) continue; // connection-only input — never has a widgets_values slot
        // ComfyUI keeps a placeholder slot for widget-type inputs even when they are
        // converted to links, so we must CONSUME a slot for every widget-type input to
        // stay aligned — but only ASSIGN the value when the input isn't a link.
        const val = wi < wv.length ? wv[wi++] : undefined;
        if (!linked.has(name) && val !== undefined) inputs[name] = val;
        // Known gotcha (out of scope): a seed widget with control_after_generate emits an
        // EXTRA trailing widgets_values entry. Harmless when it's the last widget (FLUX.2
        // RandomNoise); could misalign a mid-list KSampler — documented limitation.
      }
    } else if (wv && typeof wv === "object") {
      for (const [name, val] of Object.entries(wv)) if (!linked.has(name)) inputs[name] = val;
    }
    out[String(node.id)] = { class_type: node.type, inputs };
  }
  return out;
}

// ============================================================================
// Task 4: ComfyUI HTTP client
// ============================================================================

export interface OutputImage { filename: string; subfolder: string; type: string; }
type FetchFn = typeof fetch;

export class ComfyUIClient {
  constructor(private base: string, private fetchFn: FetchFn = fetch) {}

  static resolveBaseUrl(env: Record<string, string | undefined>): string {
    if (env.COMFYUI_URL) return env.COMFYUI_URL.replace(/\/$/, "");
    const proto = env.COMFYUI_SSL === "true" ? "https" : "http";
    const host = env.COMFYUI_HOST || "127.0.0.1";
    const port = env.COMFYUI_PORT || "8188";
    return `${proto}://${host}:${port}`;
  }

  static fromEnv(env: Record<string, string | undefined> = process.env, fetchFn: FetchFn = fetch): ComfyUIClient {
    return new ComfyUIClient(ComfyUIClient.resolveBaseUrl(env), fetchFn);
  }

  async submitPrompt(workflow: ComfyWorkflow): Promise<string> {
    const res = await this.fetchFn(`${this.base}/prompt`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: "zuul" }),
    });
    if (!res.ok) throw new ComfyUIError(`ComfyUI /prompt failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as any;
    if (data.node_errors && Object.keys(data.node_errors).length > 0) {
      throw new ComfyUIError(`ComfyUI rejected the workflow: ${JSON.stringify(data.node_errors)}`);
    }
    if (!data.prompt_id) throw new ComfyUIError("ComfyUI /prompt returned no prompt_id");
    return data.prompt_id;
  }

  async waitForImages(promptId: string, timeoutMs = 180000, intervalMs = 1500): Promise<OutputImage[]> {
    const deadline = Date.now() + timeoutMs;
    let lastStatus: number | undefined;
    while (Date.now() < deadline) {
      let res: Response;
      try {
        res = await this.fetchFn(`${this.base}/history/${promptId}`);
      } catch {
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }
      if (res.ok) {
        const hist = await res.json() as any;
        const entry = hist[promptId];
        if (entry && entry.status?.completed) {
          const images: OutputImage[] = [];
          for (const out of Object.values(entry.outputs ?? {}) as any[]) {
            for (const img of out.images ?? []) images.push(img);
          }
          if (images.length === 0) throw new ComfyUIError("ComfyUI completed but produced no images (does the workflow have a SaveImage node?)");
          return images;
        }
        if (entry?.status?.status_str === "error") throw new ComfyUIError(`ComfyUI execution error: ${JSON.stringify(entry.status)}`);
      } else {
        lastStatus = res.status;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new ComfyUIError(`Timed out after ${timeoutMs}ms waiting for ComfyUI to finish prompt ${promptId}${lastStatus ? ` (last /history status: ${lastStatus})` : ""}`);
  }

  async fetchImageBytes(img: OutputImage): Promise<Buffer> {
    const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder ?? "", type: img.type ?? "output" });
    const res = await this.fetchFn(`${this.base}/view?${q}`);
    if (!res.ok) throw new ComfyUIError(`ComfyUI /view failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async listCheckpoints(): Promise<string[]> {
    const res = await this.fetchFn(`${this.base}/object_info/CheckpointLoaderSimple`);
    if (!res.ok) throw new ComfyUIError(`ComfyUI /object_info failed: ${res.status}`);
    const data = await res.json() as any;
    const list = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
    return Array.isArray(list) ? list : [];
  }

  async listDiffusionModels(): Promise<string[]> {
    const res = await this.fetchFn(`${this.base}/object_info/UNETLoader`);
    if (!res.ok) throw new ComfyUIError(`ComfyUI /object_info failed: ${res.status}`);
    const data = await res.json() as any;
    const list = data?.UNETLoader?.input?.required?.unet_name?.[0];
    return Array.isArray(list) ? list : [];
  }

  async getObjectInfo(): Promise<Record<string, any>> {
    const res = await this.fetchFn(`${this.base}/object_info`);
    if (!res.ok) throw new ComfyUIError(`ComfyUI /object_info failed: ${res.status}`);
    return await res.json() as Record<string, any>;
  }

  // Discover a category's models from any loader's enum (clip via CLIPLoader, vae via VAELoader).
  async listLoaderOptions(nodeType: string, inputName: string): Promise<string[]> {
    const res = await this.fetchFn(`${this.base}/object_info/${nodeType}`);
    if (!res.ok) throw new ComfyUIError(`ComfyUI /object_info/${nodeType} failed: ${res.status}`);
    const data = await res.json() as any;
    const def = data?.[nodeType]?.input?.required?.[inputName]?.[0];
    if (Array.isArray(def)) return def;
    const opts = data?.[nodeType]?.input?.required?.[inputName]?.[1]?.options;
    return Array.isArray(opts) ? opts : [];
  }

  async uploadImage(bytes: Buffer, filename: string): Promise<string> {
    const form = new FormData();
    form.append("image", new Blob([bytes]), filename);
    form.append("overwrite", "true");
    const res = await this.fetchFn(`${this.base}/upload/image`, { method: "POST", body: form });
    if (!res.ok) throw new ComfyUIError(`ComfyUI /upload/image failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as any;
    if (!data?.name) throw new ComfyUIError("ComfyUI /upload/image returned no filename");
    return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
  }

  async listServerWorkflows(): Promise<string[]> {
    const res = await this.fetchFn(`${this.base}/userdata?dir=workflows&recurse=true&split=false`);
    if (!res.ok) return [];
    const data = await res.json() as any;
    return Array.isArray(data) ? data.map((d: any) => (typeof d === "string" ? d : d?.path)).filter(Boolean) : [];
  }

  async fetchServerWorkflow(name: string): Promise<unknown> {
    const enc = encodeURIComponent(`workflows/${name}`);
    const res = await this.fetchFn(`${this.base}/userdata/${enc}`);
    if (!res.ok) throw new ComfyUIError(`ComfyUI could not fetch saved workflow "${name}": ${res.status}`);
    return await res.json();
  }
}

// ============================================================================
// Task 9: Template resolver (bundled + server)
// ============================================================================

export interface TemplateSources {
  readBundled: (name: string) => Promise<ComfyWorkflow | null>;  // CLI injects fs read of zuul/workflows/<name>.json
  fetchServer: (name: string) => Promise<unknown>;               // client.fetchServerWorkflow
  getObjectInfo: () => Promise<ObjectInfo>;                      // client.getObjectInfo
}

export async function resolveTemplate(name: string, src: TemplateSources): Promise<ComfyWorkflow> {
  const bundled = await src.readBundled(name);
  if (bundled) return bundled;
  let server: unknown;
  try {
    server = await src.fetchServer(name);
  } catch {
    throw new ComfyUIError(`Template "${name}" not found in bundled zuul/workflows/ or on the ComfyUI server.`);
  }
  if (isGuiWorkflow(server)) return guiWorkflowToApi(server, await src.getObjectInfo());
  return server as ComfyWorkflow;
}

// ============================================================================
// Task 5: generateWithComfyUI orchestrator
// ============================================================================

export interface GenerateComfyOpts {
  client: ComfyUIClient;
  positive: string;
  negative?: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;            // override KSampler steps (both built-in and workflow mode)
  cfg?: number;              // override KSampler cfg
  sampler?: string;          // override KSampler sampler_name
  scheduler?: string;        // override KSampler scheduler
  checkpoint?: string;       // for built-in txt2img; auto-selected if omitted
  workflow?: ComfyWorkflow;  // pre-loaded API-format workflow (from --comfyui-workflow)
  applySize?: boolean;       // inject width/height (true only when --size explicit)
  arch?: ComfyArch;          // "sd" (default) or "flux2"
  model?: string;            // unified model name (alias of checkpoint); routed by arch
  unet?: string; clip?: string; vae?: string; // flux2 component overrides
  references?: string[];     // local reference image paths (flux2 only)
  template?: ComfyWorkflow;  // resolved template (bundled or server), already API-format
  readFileBytes?: (path: string) => Promise<Buffer>; // injected for testability (defaults to fs read in CLI)
  output: string;
  saveImage: (path: string, buf: Buffer) => Promise<string>;
}

export async function generateWithComfyUI(o: GenerateComfyOpts): Promise<string> {
  // Template / pre-resolved workflow mode (authoritative graph; inject prompt/seed/size/refs).
  const presetWf = o.template ?? o.workflow;
  if (presetWf) {
    const wf = injectIntoWorkflow(presetWf, {
      positive: o.positive, negative: o.negative, seed: o.seed,
      width: o.applySize ? o.width : undefined, height: o.applySize ? o.height : undefined,
      steps: o.steps, cfg: o.cfg, sampler: o.sampler, scheduler: o.scheduler,
    });
    const id = await o.client.submitPrompt(wf);
    console.log(`ComfyUI prompt queued (${id}); waiting for completion...`);
    const images = await o.client.waitForImages(id);
    return o.saveImage(o.output, await o.client.fetchImageBytes(images[0]));
  }

  // Native FLUX.2 path.
  if (o.arch === "flux2") {
    const res = resolveFlux2Models(
      { unet: o.unet ?? o.model, clip: o.clip, vae: o.vae },
      { clips: await o.client.listLoaderOptions("CLIPLoader", "clip_name"),
        vaes: await o.client.listLoaderOptions("VAELoader", "vae_name") },
    );
    if (isKvModel(res.unet)) {
      console.warn(`Warning: "${res.unet}" is a KV-cache build (~29 GB VRAM / RTX 5090+); it will likely OOM on smaller cards. Prefer the plain klein-9b-fp8.`);
    }
    const refNames: string[] = [];
    for (const localPath of o.references ?? []) {
      const bytes = await (o.readFileBytes ?? (async () => { throw new ComfyUIError("readFileBytes not provided"); }))(localPath);
      refNames.push(await o.client.uploadImage(bytes, localPath.split(/[\\/]/).pop() || "ref.png"));
    }
    const wf = buildFlux2Workflow({
      unet: res.unet, clip: res.clip, vae: res.vae, positive: o.positive,
      width: o.width ?? 1024, height: o.height ?? 1024, seed: o.seed,
      steps: o.steps, sampler: o.sampler, references: refNames,
    });
    const id = await o.client.submitPrompt(wf);
    console.log(`ComfyUI prompt queued (${id}); waiting for completion...`);
    const images = await o.client.waitForImages(id);
    return o.saveImage(o.output, await o.client.fetchImageBytes(images[0]));
  }

  // SD checkpoint path (default fallback). Honor the unified --comfyui-model
  // when it resolved to an SD checkpoint (o.checkpoint is the legacy alias).
  let checkpoint = o.checkpoint ?? o.model;
  if (!checkpoint) {
    const cps = await o.client.listCheckpoints();
    if (cps.length === 0) throw new ComfyUIError("No checkpoints found in ComfyUI. Set --comfyui-checkpoint or install a model.");
    checkpoint = cps[0];
    if (cps.length > 1) console.warn(`Warning: no --comfyui-checkpoint given; using "${checkpoint}". Available: ${cps.join(", ")}`);
  }
  const wf = buildTxt2ImgWorkflow({
    checkpoint, positive: o.positive, negative: o.negative,
    width: o.width ?? 1024, height: o.height ?? 1024, seed: o.seed,
    steps: o.steps, cfg: o.cfg, sampler: o.sampler, scheduler: o.scheduler,
  });
  const id = await o.client.submitPrompt(wf);
  console.log(`ComfyUI prompt queued (${id}); waiting for completion...`);
  const images = await o.client.waitForImages(id);
  const buf = await o.client.fetchImageBytes(images[0]);
  return o.saveImage(o.output, buf);
}
