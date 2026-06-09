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
// Task 3: Workflow injection (the crux)
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

export function injectIntoWorkflow(wf: ComfyWorkflow, p: InjectParams): ComfyWorkflow {
  const out: ComfyWorkflow = structuredClone(wf);

  const posId = findByTitle(out, "positive") ?? traceFromSampler(out, "positive");
  if (!posId || !out[posId]) {
    throw new ComfyUIError(
      "Could not locate the positive-prompt node in this workflow. " +
      "Title the node 'positive' (and 'negative') in ComfyUI, or use a single-KSampler workflow.",
    );
  }
  out[posId].inputs.text = p.positive;

  if (p.negative !== undefined) {
    const negId = findByTitle(out, "negative") ?? traceFromSampler(out, "negative");
    if (negId && out[negId]) out[negId].inputs.text = p.negative;
  }

  if (p.seed !== undefined) {
    for (const n of Object.values(out)) {
      if (typeof n.inputs.seed === "number") n.inputs.seed = p.seed;
    }
  }
  if (p.width !== undefined && p.height !== undefined) {
    for (const n of Object.values(out)) {
      if (n.class_type === "EmptyLatentImage") { n.inputs.width = p.width; n.inputs.height = p.height; }
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
  output: string;
  saveImage: (path: string, buf: Buffer) => Promise<string>;
}

export async function generateWithComfyUI(o: GenerateComfyOpts): Promise<string> {
  let wf: ComfyWorkflow;
  if (o.workflow) {
    wf = injectIntoWorkflow(o.workflow, {
      positive: o.positive, negative: o.negative, seed: o.seed,
      width: o.applySize ? o.width : undefined,
      height: o.applySize ? o.height : undefined,
      steps: o.steps, cfg: o.cfg, sampler: o.sampler, scheduler: o.scheduler,
    });
  } else {
    let checkpoint = o.checkpoint;
    if (!checkpoint) {
      const cps = await o.client.listCheckpoints();
      if (cps.length === 0) throw new ComfyUIError("No checkpoints found in ComfyUI. Set --comfyui-checkpoint or install a model.");
      checkpoint = cps[0];
      if (cps.length > 1) console.warn(`Warning: no --comfyui-checkpoint given; using "${checkpoint}". Available: ${cps.join(", ")}`);
    }
    wf = buildTxt2ImgWorkflow({
      checkpoint, positive: o.positive, negative: o.negative,
      width: o.width ?? 1024, height: o.height ?? 1024, seed: o.seed,
      steps: o.steps, cfg: o.cfg, sampler: o.sampler, scheduler: o.scheduler,
    });
  }
  const id = await o.client.submitPrompt(wf);
  console.log(`ComfyUI prompt queued (${id}); waiting for completion...`);
  const images = await o.client.waitForImages(id);
  const buf = await o.client.fetchImageBytes(images[0]);
  return o.saveImage(o.output, buf);
}
