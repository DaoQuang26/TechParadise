package com.techstore1.techstore1.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class AiImageEnhancementService {

    private static final String COMFY_SAVE_NODE_ID = "22";
    private static final String DEFAULT_PROMPT = "Enhance this ecommerce product photo: clean background, better lighting, "
            + "sharp details, realistic colors, and professional studio look while keeping product shape/logo unchanged.";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${app.ai.openai.api-key:}")
    private String openAiApiKey;

    @Value("${app.ai.openai.base-url:https://api.openai.com/v1}")
    private String openAiBaseUrl;

    @Value("${app.ai.openai.model:gpt-image-1}")
    private String openAiModel;

    @Value("${app.ai.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${app.ai.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiBaseUrl;

    @Value("${app.ai.gemini.model:gemini-2.5-flash-image}")
    private String geminiModel;

    @Value("${app.ai.comfy.base-url:http://127.0.0.1:8188}")
    private String comfyBaseUrl;

    @Value("${app.ai.comfy.timeout-seconds:420}")
    private int comfyTimeoutSeconds;

    @Value("${app.ai.comfy.poll-interval-ms:1500}")
    private long comfyPollIntervalMs;

    @Value("${app.ai.comfy.unet-name:qwen_image_edit_fp8_e4m3fn.safetensors}")
    private String comfyUnetName;

    @Value("${app.ai.comfy.clip-name:qwen_2.5_vl_7b_fp8_scaled.safetensors}")
    private String comfyClipName;

    @Value("${app.ai.comfy.vae-name:qwen_image_vae.safetensors}")
    private String comfyVaeName;

    @Value("${app.ai.comfy.lora-name:Qwen-Image-Edit-Lightning-4steps-V1.0-bf16.safetensors}")
    private String comfyLoraName;

    @Value("${app.ai.comfy.megapixels:0.25}")
    private double comfyMegapixels;

    @Value("${app.ai.comfy.resolution-steps:1}")
    private int comfyResolutionSteps;

    @Value("${app.ai.comfy.turbo-enabled:true}")
    private boolean comfyTurboEnabled;

    @Value("${app.ai.comfy.steps-fast:4}")
    private int comfyStepsFast;

    @Value("${app.ai.comfy.steps-slow:20}")
    private int comfyStepsSlow;

    @Value("${app.ai.comfy.cfg-fast:1.0}")
    private double comfyCfgFast;

    @Value("${app.ai.comfy.cfg-slow:2.5}")
    private double comfyCfgSlow;

    @Value("${app.ai.comfy.output-prefix:TechStoreAI}")
    private String comfyOutputPrefix;

    public AiImageEnhancementService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    public EnhancedImageResult enhanceImage(
            byte[] imageBytes,
            String contentType,
            String providerRaw,
            String promptRaw,
            String seedRaw
    ) {
        if (imageBytes == null || imageBytes.length == 0) {
            throw new IllegalArgumentException("Anh dau vao khong hop le");
        }

        normalizeProvider(providerRaw);
        String prompt = normalizePrompt(promptRaw);
        Long seed = normalizeSeed(seedRaw);
        String mimeType = normalizeMimeType(contentType);

        try {
            return callComfyUi(imageBytes, mimeType, prompt, seed);
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new RuntimeException("Khong the xu ly anh bang ComfyUI. Vui long thu lai.", ex);
        }
    }

    public void cancelComfyProcessing() {
        String baseUrl = trimTrailingSlash(comfyBaseUrl);
        if (baseUrl.isBlank()) {
            return;
        }

        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + "/interrupt"))
                    .timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .build();
            httpClient.send(request, HttpResponse.BodyHandlers.discarding());
        } catch (Exception ignored) {
            // Best effort cancel: keep endpoint resilient even when ComfyUI is offline.
        }
    }

    private EnhancedImageResult callComfyUi(byte[] imageBytes, String mimeType, String prompt, Long seed) throws Exception {
        String baseUrl = trimTrailingSlash(comfyBaseUrl);
        if (baseUrl.isBlank()) {
            throw new IllegalArgumentException("Chua cau hinh app.ai.comfy.base-url");
        }

        String extension = extensionFromMimeType(mimeType);
        String uploadFileName = "techstore-input-" + UUID.randomUUID().toString().replace("-", "") + extension;
        ComfyUploadInfo uploadInfo = uploadComfyInputImage(baseUrl, uploadFileName, mimeType, imageBytes);

        Map<String, Object> promptGraph = buildComfyPromptGraph(uploadInfo.fileName(), prompt, seed);
        String promptId = submitComfyPrompt(baseUrl, promptGraph);
        ComfyImageRef outputImage = waitForComfyOutput(baseUrl, promptId);
        byte[] outputBytes = downloadComfyOutputImage(baseUrl, outputImage);

        return new EnhancedImageResult(outputBytes, extensionFromFilename(outputImage.fileName()), "COMFYUI");
    }

    private ComfyUploadInfo uploadComfyInputImage(
            String baseUrl,
            String fileName,
            String mimeType,
            byte[] imageBytes
    ) throws Exception {
        String endpoint = baseUrl + "/upload/image";
        String boundary = "Boundary" + UUID.randomUUID().toString().replace("-", "");
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("type", "input");
        fields.put("overwrite", "true");

        byte[] requestBody = buildMultipartBody(boundary, fields, "image", fileName, mimeType, imageBytes);
        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalArgumentException("ComfyUI loi upload: " + extractApiErrorMessage(response.body(), response.statusCode()));
        }

        JsonNode root = objectMapper.readTree(response.body());
        String uploadedName = root.path("name").asText("");
        if (uploadedName.isBlank()) {
            uploadedName = fileName;
        }
        String subfolder = root.path("subfolder").asText("");
        String type = root.path("type").asText("input");
        return new ComfyUploadInfo(uploadedName, subfolder, type);
    }

    private String submitComfyPrompt(String baseUrl, Map<String, Object> promptGraph) throws Exception {
        String endpoint = baseUrl + "/prompt";
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("prompt", promptGraph);
        payload.put("client_id", UUID.randomUUID().toString());

        String requestJson = objectMapper.writeValueAsString(payload);
        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(Duration.ofSeconds(Math.max(60, comfyTimeoutSeconds)))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestJson, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalArgumentException("ComfyUI loi submit prompt: " + extractApiErrorMessage(response.body(), response.statusCode()));
        }

        JsonNode root = objectMapper.readTree(response.body());
        String promptId = root.path("prompt_id").asText("");
        if (promptId.isBlank()) {
            throw new IllegalArgumentException("ComfyUI khong tra ve prompt_id");
        }
        return promptId;
    }

    private ComfyImageRef waitForComfyOutput(String baseUrl, String promptId) throws Exception {
        String endpoint = baseUrl + "/history/" + urlEncode(promptId);
        long pollMs = Math.max(300L, comfyPollIntervalMs);
        long timeoutMs = Math.max(60L, comfyTimeoutSeconds) * 1000L;
        long deadline = System.currentTimeMillis() + timeoutMs;

        while (System.currentTimeMillis() < deadline) {
            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(30))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                JsonNode history = objectMapper.readTree(response.body());
                ComfyImageRef imageRef = extractComfyOutputImage(history, promptId);
                if (imageRef != null) {
                    return imageRef;
                }
            } else if (response.statusCode() >= 500) {
                throw new IllegalArgumentException("ComfyUI loi khi doc history: " + extractApiErrorMessage(response.body(), response.statusCode()));
            }

            try {
                Thread.sleep(pollMs);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new IllegalArgumentException("ComfyUI polling bi gian doan");
            }
        }

        throw new IllegalArgumentException("ComfyUI xu ly qua lau. Vui long giam megapixels/steps hoac thu lai.");
    }

    private ComfyImageRef extractComfyOutputImage(JsonNode history, String promptId) {
        JsonNode promptNode = history.path(promptId);
        if (!promptNode.isObject()) {
            return null;
        }

        JsonNode outputs = promptNode.path("outputs");
        if (!outputs.isObject()) {
            return null;
        }

        ComfyImageRef preferred = firstComfyImage(outputs.path(COMFY_SAVE_NODE_ID).path("images"));
        if (preferred != null) {
            return preferred;
        }

        var fields = outputs.fields();
        while (fields.hasNext()) {
            JsonNode node = fields.next().getValue();
            ComfyImageRef candidate = firstComfyImage(node.path("images"));
            if (candidate != null) {
                return candidate;
            }
        }

        return null;
    }

    private ComfyImageRef firstComfyImage(JsonNode imagesNode) {
        if (!imagesNode.isArray() || imagesNode.isEmpty()) {
            return null;
        }

        JsonNode image = imagesNode.get(0);
        String filename = image.path("filename").asText("");
        if (filename.isBlank()) {
            return null;
        }
        String subfolder = image.path("subfolder").asText("");
        String type = image.path("type").asText("output");
        return new ComfyImageRef(filename, subfolder, type);
    }

    private byte[] downloadComfyOutputImage(String baseUrl, ComfyImageRef imageRef) throws Exception {
        String endpoint = baseUrl
                + "/view?filename=" + urlEncode(imageRef.fileName())
                + "&subfolder=" + urlEncode(imageRef.subfolder())
                + "&type=" + urlEncode(imageRef.type());

        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(Duration.ofSeconds(60))
                .GET()
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String body = response.body() == null ? "" : new String(response.body(), StandardCharsets.UTF_8);
            throw new IllegalArgumentException("ComfyUI loi tai ket qua: " + extractApiErrorMessage(body, response.statusCode()));
        }
        if (response.body() == null || response.body().length == 0) {
            throw new IllegalArgumentException("ComfyUI khong tra ve du lieu anh");
        }
        return response.body();
    }

    private Map<String, Object> buildComfyPromptGraph(String imageFileName, String prompt, Long seedOverride) {
        long seed = seedOverride != null
                ? seedOverride
                : ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
        String outputPrefix = comfyOutputPrefix == null || comfyOutputPrefix.isBlank() ? "TechStoreAI" : comfyOutputPrefix.trim();

        Map<String, Object> promptGraph = new LinkedHashMap<>();
        promptGraph.put("1", node("LoadImage", Map.of("image", imageFileName)));
        promptGraph.put("2", node("ImageScaleToTotalPixels", Map.of(
                "upscale_method", "lanczos",
                "megapixels", comfyMegapixels,
                "resolution_steps", Math.max(1, comfyResolutionSteps),
                "image", List.of("1", 0)
        )));
        promptGraph.put("3", node("UNETLoader", Map.of(
                "unet_name", comfyUnetName,
                "weight_dtype", "default"
        )));
        promptGraph.put("4", node("LoraLoaderModelOnly", Map.of(
                "lora_name", comfyLoraName,
                "strength_model", 1.0,
                "model", List.of("3", 0)
        )));
        promptGraph.put("5", node("ComfySwitchNode", Map.of(
                "switch", List.of("15", 0),
                "on_false", List.of("3", 0),
                "on_true", List.of("4", 0)
        )));
        promptGraph.put("6", node("ModelSamplingAuraFlow", Map.of(
                "shift", 3.0,
                "model", List.of("5", 0)
        )));
        promptGraph.put("7", node("CFGNorm", Map.of(
                "strength", 1.0,
                "model", List.of("6", 0)
        )));
        promptGraph.put("8", node("CLIPLoader", Map.of(
                "clip_name", comfyClipName,
                "type", "qwen_image",
                "device", "default"
        )));
        promptGraph.put("9", node("VAELoader", Map.of("vae_name", comfyVaeName)));
        promptGraph.put("10", node("TextEncodeQwenImageEdit", Map.of(
                "prompt", prompt,
                "clip", List.of("8", 0),
                "vae", List.of("9", 0),
                "image", List.of("2", 0)
        )));
        promptGraph.put("11", node("TextEncodeQwenImageEdit", Map.of(
                "prompt", "",
                "clip", List.of("8", 0),
                "vae", List.of("9", 0),
                "image", List.of("2", 0)
        )));
        promptGraph.put("12", node("VAEEncode", Map.of(
                "pixels", List.of("2", 0),
                "vae", List.of("9", 0)
        )));
        promptGraph.put("13", node("PrimitiveFloat", Map.of("value", comfyCfgSlow)));
        promptGraph.put("14", node("PrimitiveFloat", Map.of("value", comfyCfgFast)));
        promptGraph.put("15", node("PrimitiveBoolean", Map.of("value", comfyTurboEnabled)));
        promptGraph.put("16", node("ComfySwitchNode", Map.of(
                "switch", List.of("15", 0),
                "on_false", List.of("13", 0),
                "on_true", List.of("14", 0)
        )));
        promptGraph.put("17", node("PrimitiveInt", Map.of("value", Math.max(1, comfyStepsSlow))));
        promptGraph.put("18", node("PrimitiveInt", Map.of("value", Math.max(1, comfyStepsFast))));
        promptGraph.put("19", node("ComfySwitchNode", Map.of(
                "switch", List.of("15", 0),
                "on_false", List.of("17", 0),
                "on_true", List.of("18", 0)
        )));
        promptGraph.put("20", node("KSampler", Map.of(
                "seed", seed,
                "steps", List.of("19", 0),
                "cfg", List.of("16", 0),
                "sampler_name", "euler",
                "scheduler", "simple",
                "denoise", 1.0,
                "model", List.of("7", 0),
                "positive", List.of("10", 0),
                "negative", List.of("11", 0),
                "latent_image", List.of("12", 0)
        )));
        promptGraph.put("21", node("VAEDecode", Map.of(
                "samples", List.of("20", 0),
                "vae", List.of("9", 0)
        )));
        promptGraph.put(COMFY_SAVE_NODE_ID, node("SaveImage", Map.of(
                "filename_prefix", outputPrefix,
                "images", List.of("21", 0)
        )));
        return promptGraph;
    }

    private Map<String, Object> node(String classType, Map<String, Object> inputs) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("inputs", inputs);
        node.put("class_type", classType);
        return node;
    }

    private EnhancedImageResult callOpenAi(byte[] imageBytes, String mimeType, String prompt) throws Exception {
        if (openAiApiKey == null || openAiApiKey.isBlank()) {
            throw new IllegalArgumentException("Chua cau hinh OpenAI API key (app.ai.openai.api-key)");
        }

        String endpoint = trimTrailingSlash(openAiBaseUrl) + "/images/edits";
        String boundary = "Boundary" + UUID.randomUUID().toString().replace("-", "");

        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("model", openAiModel);
        fields.put("prompt", prompt);
        fields.put("size", "1536x1024");
        fields.put("quality", "high");

        byte[] requestBody = buildMultipartBody(boundary, fields, "image", "product-input.png", mimeType, imageBytes);

        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(Duration.ofSeconds(120))
                .header("Authorization", "Bearer " + openAiApiKey.trim())
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalArgumentException("OpenAI loi: " + extractApiErrorMessage(response.body(), response.statusCode()));
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode data = root.path("data");
        if (!data.isArray() || data.isEmpty()) {
            throw new IllegalArgumentException("OpenAI khong tra ve du lieu anh");
        }

        String b64 = data.get(0).path("b64_json").asText("");
        if (b64.isBlank()) {
            throw new IllegalArgumentException("OpenAI khong tra ve noi dung anh");
        }

        byte[] output = Base64.getDecoder().decode(b64);
        return new EnhancedImageResult(output, ".png", "OPENAI");
    }

    private EnhancedImageResult callGemini(byte[] imageBytes, String mimeType, String prompt) throws Exception {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            throw new IllegalArgumentException("Chua cau hinh Gemini API key (app.ai.gemini.api-key)");
        }

        String modelCode = normalizeGeminiModelCode(geminiModel);
        String endpoint = trimTrailingSlash(geminiBaseUrl)
                + "/models/" + URLEncoder.encode(modelCode, StandardCharsets.UTF_8)
                + ":generateContent?key=" + URLEncoder.encode(geminiApiKey.trim(), StandardCharsets.UTF_8);

        String inputB64 = Base64.getEncoder().encodeToString(imageBytes);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("contents", List.of(
                Map.of("parts", List.of(
                        Map.of("text", prompt),
                        Map.of("inlineData", Map.of(
                                "mimeType", mimeType,
                                "data", inputB64
                        ))
                ))
        ));
        payload.put("generationConfig", Map.of("responseModalities", List.of("TEXT", "IMAGE")));

        String requestJson = objectMapper.writeValueAsString(payload);

        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(Duration.ofSeconds(120))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestJson, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalArgumentException("Gemini loi: " + extractApiErrorMessage(response.body(), response.statusCode()));
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new IllegalArgumentException("Gemini khong tra ve anh. Hay thu doi model anh trong cau hinh.");
        }

        for (JsonNode candidate : candidates) {
            JsonNode parts = candidate.path("content").path("parts");
            if (!parts.isArray()) {
                continue;
            }
            for (JsonNode part : parts) {
                JsonNode inlineData = part.path("inlineData");
                if (inlineData.isMissingNode() || inlineData.isNull()) {
                    inlineData = part.path("inline_data");
                }

                String b64 = inlineData.path("data").asText("");
                if (b64.isBlank()) {
                    continue;
                }

                String outMime = inlineData.path("mimeType").asText(inlineData.path("mime_type").asText("image/png"));
                byte[] output = Base64.getDecoder().decode(b64);
                return new EnhancedImageResult(output, extensionFromMimeType(outMime), "GEMINI");
            }
        }

        throw new IllegalArgumentException("Gemini khong tra ve anh hop le. Vui long thu prompt khac.");
    }

    private String normalizeProvider(String raw) {
        // This project only supports local ComfyUI for image enhancement.
        return "COMFYUI";
    }

    private String normalizePrompt(String raw) {
        String prompt = raw == null ? "" : raw.trim();
        if (prompt.isBlank()) {
            throw new IllegalArgumentException("Vui long nhap prompt de chay ComfyUI");
        }
        return prompt;
    }

    private Long normalizeSeed(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank() || "random".equalsIgnoreCase(value) || "-1".equals(value)) {
            return null;
        }
        try {
            long seed = Long.parseLong(value);
            if (seed < 0) {
                throw new IllegalArgumentException("Seed phai la so nguyen >= 0");
            }
            return seed;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Seed khong hop le. Hay nhap so nguyen >= 0, hoac de trong de random.");
        }
    }

    private String normalizeMimeType(String contentType) {
        String mime = contentType == null ? "" : contentType.trim().toLowerCase(Locale.ROOT);
        if (mime.startsWith("image/")) {
            return mime;
        }
        return "image/png";
    }

    private String trimTrailingSlash(String value) {
        String text = value == null ? "" : value.trim();
        while (text.endsWith("/")) {
            text = text.substring(0, text.length() - 1);
        }
        return text;
    }

    private String normalizeGeminiModelCode(String rawModelCode) {
        String modelCode = rawModelCode == null ? "" : rawModelCode.trim();
        if (modelCode.isBlank()) {
            return "gemini-2.5-flash-image";
        }
        if (modelCode.startsWith("models/")) {
            return modelCode.substring("models/".length());
        }
        return modelCode;
    }

    private String extensionFromMimeType(String mimeType) {
        String mime = mimeType == null ? "" : mimeType.toLowerCase(Locale.ROOT);
        if (mime.contains("jpeg") || mime.contains("jpg")) {
            return ".jpg";
        }
        if (mime.contains("webp")) {
            return ".webp";
        }
        if (mime.contains("gif")) {
            return ".gif";
        }
        return ".png";
    }

    private String extensionFromFilename(String filename) {
        String name = filename == null ? "" : filename.trim();
        int dotIndex = name.lastIndexOf('.');
        if (dotIndex <= -1 || dotIndex == name.length() - 1) {
            return ".png";
        }

        String ext = name.substring(dotIndex).toLowerCase(Locale.ROOT);
        if (ext.equals(".jpg") || ext.equals(".jpeg") || ext.equals(".png") || ext.equals(".webp") || ext.equals(".gif")) {
            return ext;
        }
        return ".png";
    }

    private String urlEncode(String value) {
        String safe = value == null ? "" : value;
        return URLEncoder.encode(safe, StandardCharsets.UTF_8);
    }

    private String extractApiErrorMessage(String raw, int statusCode) {
        if (raw == null || raw.isBlank()) {
            return "HTTP " + statusCode;
        }

        try {
            JsonNode root = objectMapper.readTree(raw);
            String message = root.path("error").path("message").asText("");
            if (!message.isBlank()) {
                return message;
            }
            if (root.path("error").isTextual()) {
                message = root.path("error").asText("");
                if (!message.isBlank()) {
                    return message;
                }
            }
            message = root.path("message").asText("");
            if (!message.isBlank()) {
                return message;
            }
            message = root.path("detail").asText("");
            if (!message.isBlank()) {
                return message;
            }
        } catch (Exception ignored) {
            // Fall back raw if response is not JSON.
        }

        return "HTTP " + statusCode + " - " + raw;
    }

    private byte[] buildMultipartBody(
            String boundary,
            Map<String, String> fields,
            String fileFieldName,
            String fileName,
            String mimeType,
            byte[] fileBytes
    ) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] lineBreak = "\r\n".getBytes(StandardCharsets.UTF_8);

        for (Map.Entry<String, String> entry : fields.entrySet()) {
            out.write(("--" + boundary).getBytes(StandardCharsets.UTF_8));
            out.write(lineBreak);
            out.write(("Content-Disposition: form-data; name=\"" + entry.getKey() + "\"").getBytes(StandardCharsets.UTF_8));
            out.write(lineBreak);
            out.write(lineBreak);
            out.write(entry.getValue().getBytes(StandardCharsets.UTF_8));
            out.write(lineBreak);
        }

        out.write(("--" + boundary).getBytes(StandardCharsets.UTF_8));
        out.write(lineBreak);
        out.write(("Content-Disposition: form-data; name=\"" + fileFieldName + "\"; filename=\"" + fileName + "\"")
                .getBytes(StandardCharsets.UTF_8));
        out.write(lineBreak);
        out.write(("Content-Type: " + mimeType).getBytes(StandardCharsets.UTF_8));
        out.write(lineBreak);
        out.write(lineBreak);
        out.write(fileBytes);
        out.write(lineBreak);

        out.write(("--" + boundary + "--").getBytes(StandardCharsets.UTF_8));
        out.write(lineBreak);

        return out.toByteArray();
    }

    public record EnhancedImageResult(byte[] bytes, String extension, String provider) {
    }

    private record ComfyUploadInfo(String fileName, String subfolder, String type) {
    }

    private record ComfyImageRef(String fileName, String subfolder, String type) {
    }
}
