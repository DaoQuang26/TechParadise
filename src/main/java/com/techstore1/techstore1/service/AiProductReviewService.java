package com.techstore1.techstore1.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techstore1.techstore1.dto.AiProductReviewResponse;
import com.techstore1.techstore1.entity.Product;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
// tac dung code: tao AI review cho laptop dua tren cau hinh + muc dich su dung.
public class AiProductReviewService {

    private static final int MAX_BULLET_ITEMS = 5;
    private static final Pattern RAM_PATTERN = Pattern.compile("(\\d{1,3})\\s*gb", Pattern.CASE_INSENSITIVE);
    private static final Pattern STORAGE_PATTERN = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*(tb|gb)", Pattern.CASE_INSENSITIVE);
    private static final Pattern HZ_PATTERN = Pattern.compile("(\\d{2,3})\\s*hz", Pattern.CASE_INSENSITIVE);

    private enum ProductType {
        LAPTOP,
        MONITOR,
        KEYBOARD,
        MOUSE,
        HEADPHONE,
        NETWORK,
        PC_COMPONENT,
        ACCESSORY,
        GENERAL
    }

    private final ProductService productService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${app.ai.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${app.ai.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiBaseUrl;

    @Value("${app.ai.gemini.review-model:gemini-2.5-flash}")
    private String geminiReviewModel;

    public AiProductReviewService(
            ProductService productService,
            ObjectMapper objectMapper
    ) {
        this.productService = productService;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    public AiProductReviewResponse generateProductReview(Long productId) {
        return generateProductReview(productId, null);
    }

    public AiProductReviewResponse generateProductReview(Long productId, String useCase) {
        Product product = productService.getProductById(productId);
        String normalizedUseCase = normalizeUseCaseKey(useCase);

        if (isBlank(geminiApiKey)) {
            return buildLocalReview(product, normalizedUseCase, "LOCAL_RULES", "Chưa cấu hình GEMINI_API_KEY.");
        }

        try {
            return buildGeminiReview(product, normalizedUseCase);
        } catch (Exception ex) {
            return buildLocalReview(product, normalizedUseCase, "LOCAL_RULES", buildGeminiFallbackCaution(ex));
        }
    }

    private AiProductReviewResponse buildGeminiReview(Product product, String useCase) throws Exception {
        String modelCode = normalizeGeminiModelCode(geminiReviewModel);
        String endpoint = trimTrailingSlash(geminiBaseUrl)
                + "/models/" + URLEncoder.encode(modelCode, StandardCharsets.UTF_8)
                + ":generateContent?key=" + URLEncoder.encode(geminiApiKey.trim(), StandardCharsets.UTF_8);

        String prompt = buildCategoryAwareGeminiPrompt(product, useCase);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("contents", List.of(
                Map.of("parts", List.of(Map.of("text", prompt)))
        ));
        payload.put("generationConfig", Map.of(
                "temperature", 0.25,
                "maxOutputTokens", 1400,
                "responseMimeType", "application/json"
        ));

        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(Duration.ofSeconds(45))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        objectMapper.writeValueAsString(payload),
                        StandardCharsets.UTF_8
                ))
                .build();

        HttpResponse<String> response = sendGeminiRequestWithRetry(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalArgumentException("Gemini error: " + extractApiErrorMessage(response.body(), response.statusCode()));
        }

        JsonNode root = objectMapper.readTree(response.body());
        String rawText = extractGeminiText(root);
        JsonNode aiJson = parseJsonObject(rawText);

        int fallbackScore = estimateScore(product, useCase);
        int score = sanitizeScore(aiJson.path("score").asInt(-1), fallbackScore);
        String scoreReason = sanitizeText(
                readJsonString(aiJson, "scoreReason"),
                buildFallbackScoreReason(product, useCase, score),
                420
        );
        String summary = sanitizeText(
                readJsonString(aiJson, "summary"),
                buildFallbackSummary(product, useCase, score),
                620
        );
        List<String> strengths = sanitizeList(
                readJsonStringList(aiJson, "strengths"),
                buildLocalStrengths(product, useCase)
        );
        List<String> weaknesses = sanitizeList(
                readJsonStringList(aiJson, "weaknesses"),
                buildLocalWeaknesses(product, useCase)
        );
        String detailedEvaluation = sanitizeText(
                readJsonString(aiJson, "detailedEvaluation"),
                buildFallbackDetailedEvaluation(product, useCase, score),
                820
        );
        List<String> predictedPerformance = sanitizeList(
                readJsonStringList(aiJson, "predictedPerformance"),
                buildFallbackPredictedPerformance(product, useCase, score)
        );
        String valueAndComparison = sanitizeText(
                readJsonString(aiJson, "valueAndComparison"),
                buildFallbackValueAndComparison(product, useCase, score),
                420
        );
        String conclusion = sanitizeText(
                readJsonString(aiJson, "conclusion"),
                buildFallbackConclusion(product, useCase, score),
                260
        );
        String recommendation = sanitizeText(
                readJsonString(aiJson, "recommendation"),
                buildFallbackRecommendation(product, useCase, score),
                300
        );
        String caution = sanitizeText(
                readJsonString(aiJson, "caution"),
                "Đây là phân tích tự động theo cấu hình, vui lòng đối chiếu nhu cầu thực tế.",
                280
        );

        return new AiProductReviewResponse(
                product.getId(),
                safe(product.getName()),
                normalizeUseCaseKey(useCase),
                modelCode,
                "GEMINI",
                score,
                scoreReason,
                summary,
                strengths,
                weaknesses,
                detailedEvaluation,
                predictedPerformance,
                valueAndComparison,
                conclusion,
                recommendation,
                caution
        );
    }

    private HttpResponse<String> sendGeminiRequestWithRetry(HttpRequest request) throws Exception {
        int[] retryDelaysMs = {900, 1800, 3000};
        HttpResponse<String> response = null;
        Exception lastException = null;

        for (int attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
            try {
                response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                int status = response.statusCode();
                if (status >= 200 && status < 300) {
                    return response;
                }
                if (!isRetriableStatus(status) || attempt == retryDelaysMs.length) {
                    return response;
                }
            } catch (Exception ex) {
                lastException = ex;
                if (attempt == retryDelaysMs.length) {
                    throw ex;
                }
            }

            Thread.sleep(retryDelaysMs[attempt]);
        }

        if (lastException != null) {
            throw lastException;
        }
        return response == null
                ? httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
                : response;
    }

    private boolean isRetriableStatus(int status) {
        return status == 429 || status == 500 || status == 502 || status == 503 || status == 504;
    }

    private String buildGeminiFallbackCaution(Exception ex) {
        String message = ex == null ? "" : safe(ex.getMessage()).toLowerCase(Locale.ROOT);
        if (message.contains("503") || message.contains("unavailable") || message.contains("high demand")) {
            return "Gemini đang quá tải (503), đã chuyển sang phân tích local. Vui lòng thử lại sau 1-2 phút.";
        }
        if (message.contains("429") || message.contains("quota") || message.contains("rate limit")) {
            return "Gemini đã chạm giới hạn tạm thời (429/quota), đã chuyển sang phân tích local.";
        }
        if (message.contains("401") || message.contains("403") || message.contains("api key")) {
            return "Gemini từ chối xác thực API key, đã chuyển sang phân tích local.";
        }
        return "Gemini tạm lỗi, đã chuyển sang phân tích local.";
    }

    private String buildGeminiPrompt(Product product, String useCase) {
        String normalizedUseCase = normalizeUseCaseKey(useCase);
        String useCaseLabel = useCaseLabel(normalizedUseCase);
        String useCaseGuidance = useCaseGuidance(normalizedUseCase);
        String requirements = useCaseRequirementHint(normalizedUseCase);

        List<String> productFacts = collectAllProductFacts(product);
        String factsText = productFacts.isEmpty()
                ? "- Chưa có thông tin đầu vào."
                : String.join("\n", productFacts);

        return """
                Bạn là chuyên gia đánh giá laptop.
                Bắt buộc đánh giá CHỈ dựa trên cấu hình/thông số bên dưới, KHÔNG dựa trên review người dùng.
                Mục tiêu: đánh giá laptop cho đúng mục đích sử dụng đã chọn.
                Bắt buộc đọc TOÀN BỘ dữ liệu đầu vào và ưu tiên các thông tin cụ thể của sản phẩm.

                Bắt buộc trả về ĐÚNG 1 JSON object hợp lệ, không markdown:
                {
                  "score": 1,
                  "scoreReason": "string",
                  "summary": "string",
                  "strengths": ["string"],
                  "weaknesses": ["string"],
                  "detailedEvaluation": "string",
                  "predictedPerformance": ["string"],
                  "valueAndComparison": "string",
                  "conclusion": "string",
                  "recommendation": "string",
                  "caution": "string"
                }

                Rules:
                - score là số nguyên 1-10.
                - scoreReason phải giải thích rõ vì sao điểm như vậy.
                - strengths/weaknesses phải bám sát linh kiện (CPU/GPU/RAM/SSD/Màn hình/Tản nhiệt).
                - strengths: 3-5 ý.
                - weaknesses: 3-5 ý.
                - detailedEvaluation: 1 đoạn ngắn, rõ ràng.
                - predictedPerformance: 3-5 ý, gắn với tác vụ thực tế.
                - valueAndComparison: đánh giá giá trị trong tầm giá.
                - conclusion: 1-2 câu kết luận cuối.
                - summary <= 4 câu.
                - recommendation ngắn gọn, dễ hành động.
                - Viết tiếng Việt tự nhiên, có dấu tiếng Việt đầy đủ và dấu câu rõ ràng.
                - Mọi nhận định phải có liên hệ trực tiếp với dữ liệu đầu vào; nếu thiếu dữ liệu thì nêu rõ hạn chế.
                - Tuyệt đối không bỏ qua thông tin quan trọng trong bộ dữ liệu đầu vào.

                Dữ liệu:
                - Tên sản phẩm: %s
                - Danh mục: %s
                - Mục đích: %s
                - Hướng dẫn đánh giá: %s
                - Tiêu chí kỹ thuật ưu tiên: %s
                - Giá hiện tại: %.0f VND
                - Tồn kho: %d

                Dữ liệu đầu vào đầy đủ:
                %s
                """.formatted(
                safe(product.getName()),
                product.getCategory() == null ? "Khác" : safe(product.getCategory().getName()),
                useCaseLabel,
                useCaseGuidance,
                requirements,
                product.getFinalPrice() == null ? 0D : Math.max(0D, product.getFinalPrice()),
                product.getStock() == null ? 0 : Math.max(0, product.getStock()),
                factsText
        );
    }

    private AiProductReviewResponse buildLocalReview(
            Product product,
            String useCase,
            String generatedBy,
            String cautionText
    ) {
        int score = estimateScore(product, useCase);
        String summary = buildFallbackSummary(product, useCase, score);
        List<String> strengths = buildLocalStrengths(product, useCase);
        List<String> weaknesses = buildLocalWeaknesses(product, useCase);
        String scoreReason = buildFallbackScoreReason(product, useCase, score);
        String detailedEvaluation = buildFallbackDetailedEvaluation(product, useCase, score);
        List<String> predictedPerformance = buildFallbackPredictedPerformance(product, useCase, score);
        String valueAndComparison = buildFallbackValueAndComparison(product, useCase, score);
        String conclusion = buildFallbackConclusion(product, useCase, score);
        String recommendation = buildFallbackRecommendation(product, useCase, score);

        return new AiProductReviewResponse(
                product.getId(),
                safe(product.getName()),
                normalizeUseCaseKey(useCase),
                "local-rules",
                generatedBy,
                score,
                scoreReason,
                summary,
                sanitizeList(strengths, List.of("Thông tin ưu điểm đang được cập nhật.")),
                sanitizeList(weaknesses, List.of("Nên đối chiếu thêm với nhu cầu thực tế trước khi mua.")),
                detailedEvaluation,
                sanitizeList(predictedPerformance, List.of("Đang cập nhật dữ liệu hiệu năng dự đoán.")),
                valueAndComparison,
                conclusion,
                recommendation,
                sanitizeText(cautionText, "Đây là tóm tắt tự động theo cấu hình.", 280)
        );
    }

    private List<String> buildLocalStrengths(Product product, String useCase) {
        ProductType productType = resolveProductType(product);
        if (productType != ProductType.LAPTOP) {
            return buildNonLaptopStrengths(product, useCase, productType);
        }

        int ramGb = parseRamGb(product);
        int cpuTier = cpuTier(product);
        int gpuTier = gpuTier(product);
        int refreshRate = parseRefreshRate(product);
        boolean hasSsd = hasSsd(product);
        int storageGb = storageGb(product);
        String normalizedUseCase = normalizeUseCaseKey(useCase);

        List<String> strengths = new ArrayList<>();
        if (ramGb >= 16) {
            strengths.add("RAM " + ramGb + "GB hỗ trợ đa nhiệm và giữ ứng dụng mở tốt.");
        }
        if (hasSsd) {
            if (storageGb > 0) {
                strengths.add("Lưu trữ SSD/NVMe " + storageGb + "GB giúp khởi động và mở ứng dụng nhanh.");
            } else {
                strengths.add("Có SSD/NVMe giúp tốc độ tải hệ thống nhanh hơn HDD.");
            }
        }
        if (cpuTier >= 3) {
            strengths.add("CPU thuộc nhóm hiệu năng khá/tốt, đáp ứng workload nặng ở mức hợp lý.");
        } else if (cpuTier >= 2) {
            strengths.add("CPU tầm trung, phù hợp nhu cầu phổ thông và làm việc hằng ngày.");
        }
        if ((normalizedUseCase.equals("gaming") || normalizedUseCase.equals("design") || normalizedUseCase.equals("video"))
                && gpuTier >= 2) {
            strengths.add("GPU rời là điểm cộng lớn cho mục đích " + useCaseLabel(normalizedUseCase).toLowerCase(Locale.ROOT) + ".");
        }
        if (normalizedUseCase.equals("gaming") && refreshRate >= 120) {
            strengths.add("Màn hình " + refreshRate + "Hz giúp trải nghiệm game mượt hơn.");
        }

        if (strengths.isEmpty()) {
            strengths.add("Thông số cơ bản đủ để xử lý các tác vụ nhẹ.");
        }
        return strengths.stream().limit(MAX_BULLET_ITEMS).toList();
    }

    private List<String> buildLocalWeaknesses(Product product, String useCase) {
        ProductType productType = resolveProductType(product);
        if (productType != ProductType.LAPTOP) {
            return buildNonLaptopWeaknesses(product, useCase, productType);
        }

        int ramGb = parseRamGb(product);
        int cpuTier = cpuTier(product);
        int gpuTier = gpuTier(product);
        int refreshRate = parseRefreshRate(product);
        boolean hasSsd = hasSsd(product);
        boolean likelyLaptop = isLikelyLaptop(product);
        String normalizedUseCase = normalizeUseCaseKey(useCase);

        List<String> weaknesses = new ArrayList<>();
        if (!likelyLaptop) {
            weaknesses.add("Sản phẩm này có thể không phải laptop đầy đủ, cần kiểm tra lại trước khi đánh giá theo nhu cầu laptop.");
        }

        if (normalizedUseCase.equals("gaming") || normalizedUseCase.equals("design") || normalizedUseCase.equals("video")) {
            if (gpuTier <= 0) {
                weaknesses.add("GPU tích hợp là điểm nghẽn cho mục đích " + useCaseLabel(normalizedUseCase).toLowerCase(Locale.ROOT) + ".");
            } else if (gpuTier == 1) {
                weaknesses.add("GPU rời phân khúc thấp, khó đạt hiệu năng cao với tác vụ nặng.");
            }
            if (ramGb > 0 && ramGb < 16) {
                weaknesses.add("RAM " + ramGb + "GB hơi thiếu với workload nặng/dự án lớn.");
            }
        } else if (normalizedUseCase.equals("programming")) {
            if (ramGb > 0 && ramGb < 16) {
                weaknesses.add("RAM dưới 16GB có thể chậm khi mở Docker/VM hoặc đa tác vụ song song.");
            }
            if (cpuTier <= 1) {
                weaknesses.add("CPU phân khúc thấp, thời gian build/compile có thể lâu.");
            }
        } else if (normalizedUseCase.equals("office") || normalizedUseCase.equals("study")) {
            if (ramGb > 0 && ramGb < 8) {
                weaknesses.add("RAM dưới 8GB sẽ dễ giật khi mở nhiều tab trình duyệt.");
            }
        }

        if (normalizedUseCase.equals("gaming") && refreshRate > 0 && refreshRate < 120) {
            weaknesses.add("Tần số quét " + refreshRate + "Hz giới hạn trải nghiệm game FPS cao.");
        }
        if (!hasSsd) {
            weaknesses.add("Chưa thấy dấu hiệu SSD/NVMe, tốc độ hệ thống có thể không tối ưu.");
        }
        if (cpuTier <= 1 && (normalizedUseCase.equals("video") || normalizedUseCase.equals("design"))) {
            weaknesses.add("CPU không mạnh cho render/xử lý đồ họa nặng.");
        }

        if (weaknesses.isEmpty()) {
            weaknesses.add("Chưa thấy điểm yếu rõ ràng trong thông số hiện tại.");
        }
        return weaknesses.stream().limit(MAX_BULLET_ITEMS).toList();
    }

    private String buildFallbackSummary(Product product, String useCase, int score) {
        String name = safe(product.getName());
        String useCaseLabel = useCaseLabel(useCase);
        return "Phân tích theo cấu hình cho " + name + " với mục đích " + useCaseLabel.toLowerCase(Locale.ROOT)
                + ": điểm tổng thể " + score + "/10.";
    }

    private String buildFallbackScoreReason(Product product, String useCase, int score) {
        ProductType productType = resolveProductType(product);
        if (productType != ProductType.LAPTOP) {
            return buildNonLaptopScoreReason(product, useCase, score, productType);
        }

        int ramGb = parseRamGb(product);
        int cpuTier = cpuTier(product);
        int gpuTier = gpuTier(product);
        int refreshRate = parseRefreshRate(product);
        boolean hasSsd = hasSsd(product);
        return "Điểm được tính từ CPU (tier " + cpuTier + "), GPU (tier " + gpuTier + "), RAM "
                + (ramGb > 0 ? ramGb + "GB" : "chưa rõ") + ", "
                + (hasSsd ? "có SSD/NVMe" : "chưa thấy SSD")
                + (refreshRate > 0 ? ", màn hình " + refreshRate + "Hz" : "")
                + ". Kết quả " + score + "/10 cho mục đích " + useCaseLabel(useCase).toLowerCase(Locale.ROOT) + ".";
    }

    private String buildFallbackRecommendation(Product product, String useCase, int score) {
        ProductType productType = resolveProductType(product);
        if (productType != ProductType.LAPTOP) {
            return buildNonLaptopRecommendation(useCase, score, productType);
        }

        String purpose = useCaseLabel(useCase).toLowerCase(Locale.ROOT);
        if (score >= 8) {
            return "Phù hợp tốt cho nhu cầu " + purpose + ", có thể chọn nếu giá bán hợp lý.";
        }
        if (score >= 6) {
            return "Dùng được cho " + purpose + ", nên cân nhắc nâng cấp RAM/GPU nếu workload nặng.";
        }
        return "Chưa tối ưu cho " + purpose + ", nên tham khảo mẫu có GPU/CPU mạnh hơn.";
    }

    private String buildFallbackDetailedEvaluation(Product product, String useCase, int score) {
        ProductType productType = resolveProductType(product);
        if (productType != ProductType.LAPTOP) {
            return buildNonLaptopDetailedEvaluation(product, useCase, score, productType);
        }

        int ramGb = parseRamGb(product);
        int refreshRate = parseRefreshRate(product);
        int storage = storageGb(product);
        int cpuTier = cpuTier(product);
        int gpuTier = gpuTier(product);

        String ramText = ramGb > 0 ? ramGb + "GB" : "chưa rõ dung lượng";
        String storageText = storage > 0 ? storage + "GB" : "chưa rõ dung lượng";
        String refreshText = refreshRate > 0 ? refreshRate + "Hz" : "chưa rõ tần số quét";

        return "Đánh giá tổng hợp cho " + useCaseLabel(useCase).toLowerCase(Locale.ROOT)
                + ": CPU tier " + cpuTier + ", GPU tier " + gpuTier + ", RAM " + ramText
                + ", lưu trữ " + storageText + ", màn hình " + refreshText
                + ". Tổng điểm " + score + "/10 phản ánh mức độ đáp ứng thực tế.";
    }

    private List<String> buildFallbackPredictedPerformance(Product product, String useCase, int score) {
        ProductType productType = resolveProductType(product);
        if (productType != ProductType.LAPTOP) {
            return buildNonLaptopPredictedPerformance(product, useCase, score, productType);
        }

        String normalizedUseCase = normalizeUseCaseKey(useCase);
        List<String> out = new ArrayList<>();

        if ("gaming".equals(normalizedUseCase)) {
            if (score >= 8) {
                out.add("Game eSports có thể đạt FPS ổn định ở mức cao.");
                out.add("Game AAA có khả năng chơi được ở medium-high tùy theo tựa.");
            } else if (score >= 6) {
                out.add("Game eSports chạy ổn ở thiết lập trung bình.");
                out.add("Game AAA cần giảm thiết lập để giữ độ mượt.");
            } else {
                out.add("Phù hợp game nhẹ/eSports ở thiết lập thấp.");
                out.add("Game AAA dễ gặp giới hạn FPS và nhiệt độ.");
            }
        } else if ("design".equals(normalizedUseCase) || "video".equals(normalizedUseCase)) {
            out.add(score >= 8
                    ? "Xử lý dự án đồ họa/video tầm trung đến nặng khá ổn định."
                    : "Phù hợp dự án nhẹ đến trung bình, dự án nặng cần cân nhắc.");
            out.add("Khả năng preview timeline/phóng to nhiều layer phụ thuộc RAM và GPU.");
        } else if ("programming".equals(normalizedUseCase)) {
            out.add(score >= 8
                    ? "Build project vừa-lớn và đa tác vụ IDE + browser + Docker khá mượt."
                    : "Build project vừa ổn định, workload nặng cần tối ưu môi trường.");
            out.add("Khi mở Docker/VM, RAM là yếu tố ảnh hưởng rõ.");
        } else {
            out.add(score >= 8
                    ? "Tác vụ văn phòng/học tập đa nhiệm diễn ra mượt."
                    : "Tác vụ cơ bản đạt yêu cầu, đa nhiệm nặng có thể chậm.");
            out.add("Họp online, mở nhiều tab trình duyệt phụ thuộc RAM và tốc độ SSD.");
        }

        out.add("Hiệu năng thực tế có thể thay đổi theo nhiệt độ phòng và tình trạng tản nhiệt.");
        return out.stream().limit(MAX_BULLET_ITEMS).toList();
    }

    private String buildFallbackValueAndComparison(Product product, String useCase, int score) {
        double finalPrice = product.getFinalPrice() == null ? 0D : Math.max(0D, product.getFinalPrice());
        String band;
        if (finalPrice <= 0D) {
            band = "chưa xác định";
        } else if (finalPrice < 15000000D) {
            band = "phổ thông";
        } else if (finalPrice < 25000000D) {
            band = "tầm trung";
        } else {
            band = "cao";
        }

        return "Trong tầm giá " + band + " (" + String.format(Locale.ROOT, "%.0f", finalPrice) + " VND),"
                + " điểm " + score + "/10 cho nhu cầu " + useCaseLabel(useCase).toLowerCase(Locale.ROOT)
                + ". Nên đối chiếu thêm với 1-2 mẫu cùng giá để tối ưu tỷ lệ hiệu năng/chi phí.";
    }

    private String buildFallbackConclusion(Product product, String useCase, int score) {
        ProductType productType = resolveProductType(product);
        if (productType != ProductType.LAPTOP) {
            return buildNonLaptopConclusion(useCase, score, productType);
        }

        String purpose = useCaseLabel(useCase).toLowerCase(Locale.ROOT);
        if (score >= 8) {
            return "Cấu hình này đáp ứng tốt mục đích " + purpose + ". Có thể chọn mua nếu giá bán và bảo hành phù hợp.";
        }
        if (score >= 6) {
            return "Cấu hình dùng được cho " + purpose + " ở mức khá, nhưng cần cân nhắc nếu bạn có workload nặng.";
        }
        return "Cấu hình chưa phù hợp cho " + purpose + ". Ưu tiên mẫu có GPU/CPU/RAM cao hơn.";
    }

    private int estimateScore(Product product, String useCase) {
        String normalizedUseCase = normalizeUseCaseKey(useCase);
        ProductType productType = resolveProductType(product);
        if (productType != ProductType.LAPTOP) {
            return estimateNonLaptopScore(product, useCase, productType);
        }

        int cpuTier = cpuTier(product);
        int gpuTier = gpuTier(product);
        int ramGb = parseRamGb(product);
        int refreshRate = parseRefreshRate(product);
        boolean hasSsd = hasSsd(product);

        int score = 5;

        switch (normalizedUseCase) {
            case "gaming" -> {
                score += cpuTier >= 3 ? 1 : (cpuTier <= 1 ? -1 : 0);
                score += gpuTier >= 2 ? 3 : (gpuTier == 1 ? 1 : -3);
                score += ramGb >= 16 ? 1 : (ramGb >= 8 ? -1 : -2);
                score += hasSsd ? 1 : -1;
                score += refreshRate >= 120 ? 1 : (refreshRate > 0 && refreshRate < 75 ? -1 : 0);
            }
            case "design" -> {
                score += cpuTier >= 3 ? 1 : (cpuTier <= 1 ? -1 : 0);
                score += gpuTier >= 2 ? 2 : (gpuTier == 1 ? 0 : -2);
                score += ramGb >= 16 ? 1 : -1;
                score += hasSsd ? 1 : -1;
            }
            case "video" -> {
                score += cpuTier >= 3 ? 2 : (cpuTier <= 1 ? -1 : 0);
                score += gpuTier >= 2 ? 2 : (gpuTier == 1 ? 0 : -2);
                score += ramGb >= 16 ? 1 : (ramGb >= 8 ? -1 : -2);
                score += hasSsd ? 1 : -1;
            }
            case "programming" -> {
                score += cpuTier >= 2 ? 1 : -1;
                score += ramGb >= 16 ? 2 : (ramGb >= 8 ? 0 : -2);
                score += hasSsd ? 1 : -1;
                score += gpuTier >= 2 ? 0 : -1;
            }
            case "office", "study" -> {
                score += cpuTier >= 1 ? 1 : -1;
                score += ramGb >= 8 ? 1 : -2;
                score += hasSsd ? 1 : 0;
                score += gpuTier <= 0 ? 0 : 1;
            }
            default -> {
                score += cpuTier >= 2 ? 1 : -1;
                score += ramGb >= 8 ? 1 : -1;
                score += hasSsd ? 1 : 0;
                score += gpuTier >= 2 ? 1 : 0;
            }
        }

        return sanitizeScore(score, 5);
    }

    private boolean isLikelyLaptop(Product product) {
        String category = product.getCategory() == null ? "" : safe(product.getCategory().getName()).toLowerCase(Locale.ROOT);
        String name = safe(product.getName()).toLowerCase(Locale.ROOT);
        return category.contains("laptop")
                || category.contains("notebook")
                || name.contains("laptop")
                || name.contains("notebook")
                || name.contains("macbook");
    }

    private int cpuTier(Product product) {
        String text = normalizeMatchText(String.join(" ", collectSpecLines(product)));
        if (containsAny(text, "ultra 9", "core i9", "i9-", "ryzen 9", "r9")) {
            return 4;
        }
        if (containsAny(text, "ultra 7", "core i7", "i7-", "ryzen 7", "r7")) {
            return 3;
        }
        if (containsAny(text, "ultra 5", "core i5", "i5-", "ryzen 5", "r5")) {
            return 2;
        }
        if (containsAny(text, "core i3", "i3-", "ryzen 3", "r3")) {
            return 1;
        }
        if (containsAny(text, "celeron", "pentium", "athlon", "n4020", "n4500", "n5100")) {
            return 0;
        }
        return 2;
    }

    private int gpuTier(Product product) {
        String text = normalizeMatchText(String.join(" ", collectSpecLines(product)));

        boolean integrated = containsAny(text, "uhd", "iris xe", "iris", "vega", "integrated", "onboard");
        boolean entryDedicated = containsAny(text, "mx330", "mx350", "mx450", "mx550");
        boolean strongDedicated = containsAny(text, "rtx", "gtx", "rx ", "arc a", "radeon rx");

        if (strongDedicated) {
            return 2;
        }
        if (entryDedicated) {
            return 1;
        }
        if (integrated) {
            return 0;
        }
        if (containsAny(text, "radeon", "nvidia")) {
            return 1;
        }
        return 0;
    }

    private int parseRamGb(Product product) {
        String text = String.join(" ", collectSpecLines(product));
        int max = 0;
        Matcher matcher = RAM_PATTERN.matcher(text);
        while (matcher.find()) {
            try {
                max = Math.max(max, Integer.parseInt(matcher.group(1)));
            } catch (NumberFormatException ignored) {
                // Ignore invalid number chunks.
            }
        }
        return max;
    }

    private int parseRefreshRate(Product product) {
        String text = String.join(" ", collectSpecLines(product));
        int max = 0;
        Matcher matcher = HZ_PATTERN.matcher(text);
        while (matcher.find()) {
            try {
                int hz = Integer.parseInt(matcher.group(1));
                max = Math.max(max, hz);
            } catch (NumberFormatException ignored) {
                // Ignore invalid refresh numbers.
            }
        }
        return max;
    }

    private int storageGb(Product product) {
        String text = String.join(" ", collectSpecLines(product));
        int maxGb = 0;
        Matcher matcher = STORAGE_PATTERN.matcher(text);
        while (matcher.find()) {
            try {
                double number = Double.parseDouble(matcher.group(1));
                String unit = safe(matcher.group(2)).toLowerCase(Locale.ROOT);
                int gb = "tb".equals(unit) ? (int) Math.round(number * 1024D) : (int) Math.round(number);
                maxGb = Math.max(maxGb, gb);
            } catch (Exception ignored) {
                // Ignore malformed storage strings.
            }
        }
        return maxGb;
    }

    private boolean hasSsd(Product product) {
        String text = normalizeMatchText(String.join(" ", collectSpecLines(product)));
        return containsAny(text, "ssd", "nvme", "pcie");
    }

    private List<String> collectSpecLines(Product product) {
        List<String> specs = new ArrayList<>();
        addIfPresent(specs, "CPU", product.getCpu());
        addIfPresent(specs, "RAM", product.getRam());
        addIfPresent(specs, "Storage", product.getStorage());
        addIfPresent(specs, "GPU", product.getGpu());
        addIfPresent(specs, "Screen", product.getScreen());
        addIfPresent(specs, "Battery", product.getBattery());
        addIfPresent(specs, "OS", product.getOperatingSystem());

        for (String line : parseMultiline(product.getQuickSpecs())) {
            specs.add("QuickSpec: " + line);
        }
        for (String line : parseMultiline(product.getDetailSpecs())) {
            specs.add("Detail: " + line);
        }
        return specs;
    }

    private List<String> collectAllProductFacts(Product product) {
        List<String> facts = new ArrayList<>();
        if (product == null) {
            facts.add("- Không có dữ liệu sản phẩm.");
            return facts;
        }

        addFact(facts, "ID", product.getId() == null ? "" : String.valueOf(product.getId()));
        addFact(facts, "Tên", product.getName());
        addFact(facts, "Danh mục", product.getCategory() == null ? "" : safe(product.getCategory().getName()));
        addFact(facts, "Mô tả", product.getDescription());
        addFact(facts, "Giá niêm yết", product.getPrice() == null ? "" : String.format(Locale.ROOT, "%.0f VND", product.getPrice()));
        addFact(facts, "Giảm giá", product.getDiscountPercent() == null ? "" : String.format(Locale.ROOT, "%.1f%%", product.getDiscountPercent()));
        addFact(facts, "Giá hiện tại", product.getFinalPrice() == null ? "" : String.format(Locale.ROOT, "%.0f VND", product.getFinalPrice()));
        addFact(facts, "Tồn kho", product.getStock() == null ? "" : String.valueOf(product.getStock()));
        addFact(facts, "Ảnh đại diện", product.getImageUrl());
        addFact(facts, "CPU", product.getCpu());
        addFact(facts, "RAM", product.getRam());
        addFact(facts, "Storage", product.getStorage());
        addFact(facts, "GPU", product.getGpu());
        addFact(facts, "Screen", product.getScreen());
        addFact(facts, "Battery", product.getBattery());
        addFact(facts, "Camera", product.getCamera());
        addFact(facts, "Hệ điều hành", product.getOperatingSystem());
        addFact(facts, "Thời điểm tạo", product.getCreatedAt() == null ? "" : String.valueOf(product.getCreatedAt()));
        addFact(facts, "Điểm đánh giá trung bình", product.getAverageRating() == null ? "" : String.format(Locale.ROOT, "%.2f", product.getAverageRating()));
        addFact(facts, "Tổng số đánh giá", product.getTotalReviews() == null ? "" : String.valueOf(product.getTotalReviews()));

        List<String> gallery = parseMultiline(product.getGalleryImages());
        if (!gallery.isEmpty()) {
            for (int i = 0; i < gallery.size(); i++) {
                addFact(facts, "Ảnh thư viện " + (i + 1), gallery.get(i));
            }
        }

        List<String> quickSpecs = parseMultiline(product.getQuickSpecs());
        if (!quickSpecs.isEmpty()) {
            for (int i = 0; i < quickSpecs.size(); i++) {
                addFact(facts, "Thông số nhanh " + (i + 1), quickSpecs.get(i));
            }
        }

        List<String> detailSpecs = parseMultiline(product.getDetailSpecs());
        if (!detailSpecs.isEmpty()) {
            for (int i = 0; i < detailSpecs.size(); i++) {
                addFact(facts, "Thông số chi tiết " + (i + 1), detailSpecs.get(i));
            }
        }

        if (facts.isEmpty()) {
            facts.add("- Không có thông tin chi tiết để phân tích.");
        }
        return facts;
    }

    private void addIfPresent(List<String> holder, String label, String value) {
        String clean = safe(value);
        if (!clean.isBlank()) {
            holder.add(label + ": " + clean);
        }
    }

    private void addFact(List<String> holder, String label, String value) {
        String cleanLabel = safe(label);
        String cleanValue = safe(value);
        if (cleanLabel.isBlank() || cleanValue.isBlank()) {
            return;
        }
        holder.add("- " + cleanLabel + ": " + cleanValue);
    }

    private String extractGeminiText(JsonNode root) {
        if (root == null) {
            return "";
        }
        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray()) {
            return "";
        }
        for (JsonNode candidate : candidates) {
            JsonNode parts = candidate.path("content").path("parts");
            if (!parts.isArray()) {
                continue;
            }
            for (JsonNode part : parts) {
                String text = part.path("text").asText("");
                if (!isBlank(text)) {
                    return text.trim();
                }
            }
        }
        return "";
    }

    private JsonNode parseJsonObject(String raw) throws Exception {
        if (isBlank(raw)) {
            throw new IllegalArgumentException("Gemini không trả về nội dung");
        }
        String text = raw.trim();
        try {
            return objectMapper.readTree(text);
        } catch (Exception ignored) {
            int start = text.indexOf('{');
            int end = text.lastIndexOf('}');
            if (start >= 0 && end > start) {
                return objectMapper.readTree(text.substring(start, end + 1));
            }
            throw new IllegalArgumentException("Gemini trả về JSON không hợp lệ");
        }
    }

    private List<String> readJsonStringList(JsonNode root, String fieldName) {
        JsonNode node = root == null ? null : root.path(fieldName);
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (JsonNode item : node) {
            String text = item == null ? "" : item.asText("");
            if (!isBlank(text)) {
                out.add(text.trim());
            }
        }
        return out;
    }

    private String readJsonString(JsonNode root, String fieldName) {
        if (root == null) {
            return "";
        }
        String value = root.path(fieldName).asText("");
        return value == null ? "" : value.trim();
    }

    private List<String> sanitizeList(List<String> rawList, List<String> fallbackList) {
        List<String> out = new ArrayList<>();
        if (rawList != null) {
            for (String raw : rawList) {
                String clean = sanitizeText(raw, "", 220);
                if (!clean.isBlank()) {
                    out.add(clean);
                }
                if (out.size() >= MAX_BULLET_ITEMS) {
                    break;
                }
            }
        }
        if (!out.isEmpty()) {
            return out;
        }

        List<String> fallback = fallbackList == null ? List.of() : fallbackList;
        for (String item : fallback) {
            String clean = sanitizeText(item, "", 220);
            if (!clean.isBlank()) {
                out.add(clean);
            }
            if (out.size() >= MAX_BULLET_ITEMS) {
                break;
            }
        }
        if (out.isEmpty()) {
            out.add("Đang cập nhật dữ liệu phân tích.");
        }
        return out;
    }

    private int sanitizeScore(int rawScore, int fallbackScore) {
        int value = rawScore < 1 || rawScore > 10 ? fallbackScore : rawScore;
        return Math.max(1, Math.min(10, value));
    }

    private String sanitizeText(String raw, String fallback, int maxLen) {
        String text = safe(raw);
        if (text.isBlank()) {
            text = fallback == null ? "" : fallback.trim();
        }
        int limit = Math.max(24, maxLen);
        if (text.length() <= limit) {
            return text;
        }
        return text.substring(0, limit).trim() + "...";
    }

    private List<String> parseMultiline(String raw) {
        if (isBlank(raw)) {
            return List.of();
        }
        return List.of(raw.split("\\r?\\n"))
                .stream()
                .map(this::safe)
                .filter(line -> !line.isBlank())
                .toList();
    }

    private String normalizeGeminiModelCode(String rawModelCode) {
        String modelCode = safe(rawModelCode);
        if (modelCode.isBlank()) {
            return "gemini-2.5-flash";
        }
        if (modelCode.startsWith("models/")) {
            return modelCode.substring("models/".length());
        }
        return modelCode;
    }

    private String trimTrailingSlash(String value) {
        String text = safe(value);
        while (text.endsWith("/")) {
            text = text.substring(0, text.length() - 1);
        }
        return text;
    }

    private String extractApiErrorMessage(String raw, int statusCode) {
        if (isBlank(raw)) {
            return "HTTP " + statusCode;
        }
        try {
            JsonNode root = objectMapper.readTree(raw);
            String message = root.path("error").path("message").asText("");
            if (!message.isBlank()) {
                return message;
            }
            message = root.path("message").asText("");
            if (!message.isBlank()) {
                return message;
            }
        } catch (Exception ignored) {
            // Ignore and fallback to raw text below.
        }
        return "HTTP " + statusCode + " - " + raw;
    }

    private String normalizeUseCaseKey(String rawUseCase) {
        String key = safe(rawUseCase).toLowerCase(Locale.ROOT);
        return switch (key) {
            case "gaming", "office", "design", "video", "programming", "study" -> key;
            default -> "";
        };
    }

    private String useCaseLabel(String useCase) {
        String key = normalizeUseCaseKey(useCase);
        return switch (key) {
            case "gaming" -> "Chơi game";
            case "office" -> "Văn phòng";
            case "design" -> "Thiết kế đồ họa";
            case "video" -> "Dựng video";
            case "programming" -> "Lập trình";
            case "study" -> "Học tập";
            default -> "Tổng quan";
        };
    }

    private String useCaseGuidance(String useCase) {
        String key = normalizeUseCaseKey(useCase);
        return switch (key) {
            case "gaming" -> "Ưu tiên GPU, tần số quét màn hình, tản nhiệt, RAM và CPU.";
            case "office" -> "Ưu tiên độ ổn định, pin, bàn phím, màn hình và hiệu năng đa tác vụ cơ bản.";
            case "design" -> "Ưu tiên GPU, RAM, CPU và chất lượng màn hình cho đồ họa.";
            case "video" -> "Ưu tiên CPU/GPU cho render, RAM và lưu trữ nhanh cho timeline.";
            case "programming" -> "Ưu tiên CPU, RAM, SSD cho build code, Docker/VM và đa nhiệm.";
            case "study" -> "Ưu tiên hiệu năng cân bằng, pin, trọng lượng và giá trị sử dụng.";
            default -> "Đánh giá cân bằng giữa CPU, GPU, RAM, SSD và màn hình.";
        };
    }

    private String useCaseRequirementHint(String useCase) {
        String key = normalizeUseCaseKey(useCase);
        return switch (key) {
            case "gaming" -> "Để chơi game mượt: nên có GPU rời, RAM >= 16GB, SSD và màn hình >= 120Hz là lợi thế.";
            case "office" -> "Mức tối thiểu: CPU phổ thông, RAM >= 8GB, SSD để mở ứng dụng nhanh.";
            case "design" -> "Nên có GPU rời, RAM >= 16GB, màn hình chất lượng tốt.";
            case "video" -> "Nên có CPU/GPU mạnh, RAM >= 16GB, SSD tốc độ cao.";
            case "programming" -> "Nên có RAM >= 16GB, SSD, CPU tầm trung trở lên.";
            case "study" -> "Nên có RAM >= 8GB, SSD, hiệu năng ổn định và giá hợp lý.";
            default -> "Đánh giá tổng quan theo tầm cấu hình phổ biến.";
        };
    }

    private String buildCategoryAwareGeminiPrompt(Product product, String useCase) {
        String normalizedUseCase = normalizeUseCaseKey(useCase);
        ProductType productType = resolveProductType(product);
        String useCaseLabel = useCaseLabel(normalizedUseCase);
        String useCaseGuidance = useCaseGuidance(normalizedUseCase, productType);
        String requirements = useCaseRequirementHint(normalizedUseCase, productType);
        String productTypeLabel = productTypeLabel(productType);
        String focusComponents = focusComponentsHint(productType);

        List<String> productFacts = collectAllProductFacts(product);
        String factsText = productFacts.isEmpty()
                ? "- Chua co thong tin dau vao."
                : String.join("\n", productFacts);

        return """
                Ban la chuyen gia danh gia san pham cong nghe.
                Bat buoc danh gia CHI dua tren thong so duoi day, KHONG dua tren review nguoi dung.
                Muc tieu: danh gia dung theo LOAI SAN PHAM va muc dich su dung da chon.

                Bat buoc tra ve DUNG 1 JSON object hop le, khong markdown:
                {
                  "score": 1,
                  "scoreReason": "string",
                  "summary": "string",
                  "strengths": ["string"],
                  "weaknesses": ["string"],
                  "detailedEvaluation": "string",
                  "predictedPerformance": ["string"],
                  "valueAndComparison": "string",
                  "conclusion": "string",
                  "recommendation": "string",
                  "caution": "string"
                }

                Rules:
                - score la so nguyen 1-10.
                - strengths/weaknesses phai bam sat thong so quan trong cua tung loai san pham.
                - strengths: 3-5 y.
                - weaknesses: 3-5 y.
                - predictedPerformance: 3-5 y, gan voi tac vu thuc te.
                - summary <= 4 cau.
                - Viet tieng Viet tu nhien, ro rang.
                - Neu thieu du lieu, neu ro han che thay vi doan.

                Du lieu:
                - Ten san pham: %s
                - Danh muc: %s
                - Loai phan tich: %s
                - Muc dich: %s
                - Huong dan danh gia: %s
                - Tieu chi uu tien: %s
                - Trong tam tham dinh: %s
                - Gia hien tai: %.0f VND
                - Ton kho: %d

                Du lieu dau vao day du:
                %s
                """.formatted(
                safe(product.getName()),
                product.getCategory() == null ? "Khac" : safe(product.getCategory().getName()),
                productTypeLabel,
                useCaseLabel,
                useCaseGuidance,
                requirements,
                focusComponents,
                product.getFinalPrice() == null ? 0D : Math.max(0D, product.getFinalPrice()),
                product.getStock() == null ? 0 : Math.max(0, product.getStock()),
                factsText
        );
    }

    private String useCaseGuidance(String useCase, ProductType productType) {
        if (productType == ProductType.LAPTOP) {
            return useCaseGuidance(useCase);
        }

        String key = normalizeUseCaseKey(useCase);
        return switch (productType) {
            case MONITOR -> switch (key) {
                case "gaming" -> "Uu tien tan so quet, do tre, dong bo hinh anh va cong ket noi.";
                case "design", "video" -> "Uu tien mau sac, do phu mau, do phan giai va do dong deu tam nen.";
                default -> "Uu tien do thoai mai khi xem lau, do net va ket noi on dinh.";
            };
            case KEYBOARD -> switch (key) {
                case "gaming" -> "Uu tien do tre phim, anti-ghosting, polling rate, switch phu hop.";
                case "programming", "office", "study" -> "Uu tien cam giac go, do on, bo cuc phim va ket noi linh hoat.";
                default -> "Uu tien trai nghiem go, do ben va tinh nang su dung hang ngay.";
            };
            case MOUSE -> switch (key) {
                case "gaming" -> "Uu tien sensor, polling rate, do tre ket noi, trong luong.";
                default -> "Uu tien do chinh xac, cong thai hoc, pin va ket noi on dinh.";
            };
            case HEADPHONE -> switch (key) {
                case "gaming" -> "Uu tien do tre am thanh, chat luong mic, dinh huong va do thoai mai.";
                case "video" -> "Uu tien do trung thuc am thanh, do tre va cach am.";
                default -> "Uu tien chat luong am thanh, do em tai, ket noi va mic.";
            };
            case NETWORK -> "Uu tien do on dinh ket noi, bang thong, do phu song va do tre.";
            case ACCESSORY, GENERAL ->
                    "Uu tien thong so thuc dung, tinh tuong thich, do ben va gia tri su dung.";
            default -> "Uu tien thong so phu hop voi muc dich thuc te.";
        };
    }

    private String useCaseRequirementHint(String useCase, ProductType productType) {
        if (productType == ProductType.LAPTOP) {
            return useCaseRequirementHint(useCase);
        }

        String key = normalizeUseCaseKey(useCase);
        return switch (productType) {
            case MONITOR -> switch (key) {
                case "gaming" -> "Nen co 120Hz tro len, do tre thap, cong ket noi phu hop.";
                case "design", "video" -> "Nen co tam nen IPS/OLED, do phu mau cao, do phan giai tu QHD tro len.";
                default -> "Nen co kich thuoc va do net phu hop, flicker low va ket noi day du.";
            };
            case KEYBOARD -> switch (key) {
                case "gaming" -> "Nen co anti-ghosting/NKRO, do tre thap, switch phu hop game.";
                default -> "Nen co cam giac go tot, do on hop ly, ket noi on dinh.";
            };
            case MOUSE -> switch (key) {
                case "gaming" -> "Nen co sensor tot, polling rate cao va do tre ket noi thap.";
                default -> "Nen co cong thai hoc tot, tracking on dinh va pin ben.";
            };
            case HEADPHONE -> switch (key) {
                case "gaming" -> "Nen co low latency, mic ro, kha nang dinh huong tot.";
                default -> "Nen co am thanh can bang, de deo lau, ket noi on dinh.";
            };
            case NETWORK ->
                    "Nen co chuan Wi-Fi moi, bang thong du, do phu song rong va firmware on dinh.";
            case ACCESSORY, GENERAL ->
                    "Nen uu tien tinh tuong thich, do ben, va thong so phuc vu truc tiep nhu cau su dung.";
            default -> "Danh gia tong quan theo thong so co san.";
        };
    }

    private String focusComponentsHint(ProductType productType) {
        return switch (productType) {
            case LAPTOP -> "CPU, GPU, RAM, SSD, man hinh, tan nhiet.";
            case MONITOR -> "Tan so quet, tam nen, do phan giai, do phu mau, cong ket noi.";
            case KEYBOARD -> "Loai switch, bo cuc, polling rate, anti-ghosting, ket noi, vat lieu keycap.";
            case MOUSE -> "Sensor, DPI/CPI, polling rate, trong luong, ket noi, pin.";
            case HEADPHONE -> "Driver, do tre, chat luong mic, cach am/ANC, ket noi, do thoai mai.";
            case NETWORK -> "Chuan Wi-Fi, bang tan, toc do cong LAN/WAN, phu song, tinh nang mesh.";
            case PC_COMPONENT -> "Hieu nang linh kien, tuong thich, nhiet do, bang thong va kha nang nang cap.";
            case ACCESSORY -> "Tinh tuong thich, do ben, cong suat/chuan ket noi, gia tri su dung.";
            default -> "Thong so ky thuat cot loi va tinh phu hop voi muc dich su dung.";
        };
    }

    private ProductType resolveProductType(Product product) {
        String fingerprint = normalizedTypeFingerprint(product);
        if (containsAny(fingerprint, "laptop", "notebook", "macbook")) {
            return ProductType.LAPTOP;
        }
        if (containsAny(fingerprint, "man hinh", "monitor", "display")) {
            return ProductType.MONITOR;
        }
        if (containsAny(fingerprint, "ban phim", "keyboard")) {
            return ProductType.KEYBOARD;
        }
        if (containsAny(fingerprint, "chuot", "mouse")) {
            return ProductType.MOUSE;
        }
        if (containsAny(fingerprint, "tai nghe", "headphone", "headset", "earbud")) {
            return ProductType.HEADPHONE;
        }
        if (containsAny(fingerprint, "thiet bi mang", "router", "mesh", "access point", "wifi")) {
            return ProductType.NETWORK;
        }
        if (containsAny(fingerprint, "linh kien", "mainboard", "vga", "card man hinh", "cpu", "ram", "ssd")) {
            return ProductType.PC_COMPONENT;
        }
        if (containsAny(fingerprint, "phu kien", "accessory", "dock", "hub", "cap", "adapter")) {
            return ProductType.ACCESSORY;
        }
        return ProductType.GENERAL;
    }

    private String productTypeLabel(ProductType productType) {
        return switch (productType) {
            case LAPTOP -> "Laptop";
            case MONITOR -> "Man hinh";
            case KEYBOARD -> "Ban phim";
            case MOUSE -> "Chuot";
            case HEADPHONE -> "Tai nghe";
            case NETWORK -> "Thiet bi mang";
            case PC_COMPONENT -> "Linh kien PC";
            case ACCESSORY -> "Phu kien";
            default -> "San pham cong nghe";
        };
    }

    private List<String> buildNonLaptopStrengths(Product product, String useCase, ProductType productType) {
        List<String> specLines = collectSpecLines(product);
        String specText = normalizeMatchText(String.join(" ", specLines));
        int specCount = specLines.size();
        List<String> strengths = new ArrayList<>();

        if (specCount >= 6) {
            strengths.add("Thong tin thong so kha day du, de doi chieu voi nhu cau thuc te.");
        }

        switch (productType) {
            case MONITOR -> {
                if (containsAny(specText, "120hz", "144hz", "165hz", "240hz")) {
                    strengths.add("Tan so quet cao, phu hop trai nghiem hinh anh muot.");
                }
                if (containsAny(specText, "ips", "oled", "mini led", "qled")) {
                    strengths.add("Tam nen hien thi chat luong tot cho mau sac va goc nhin.");
                }
                if (containsAny(specText, "2k", "qhd", "4k", "uhd")) {
                    strengths.add("Do phan giai cao la diem cong cho do net va khong gian lam viec.");
                }
            }
            case KEYBOARD -> {
                if (containsAny(specText, "switch", "mechanical", "hot swap", "hotswap")) {
                    strengths.add("He phim/switch huong toi trai nghiem go va kha nang tuy bien.");
                }
                if (containsAny(specText, "wireless", "bluetooth", "2.4g")) {
                    strengths.add("Ket noi linh hoat, gon ban lam viec.");
                }
                if (containsAny(specText, "anti-ghost", "nkro", "rgb")) {
                    strengths.add("Tinh nang ho tro gaming va su dung dai hanh trinh.");
                }
            }
            case MOUSE -> {
                if (containsAny(specText, "paw", "hero", "sensor")) {
                    strengths.add("Cam bien duoc de cap ro rang, uu tien do chinh xac.");
                }
                if (containsAny(specText, "1000hz", "2000hz", "4000hz", "8000hz")) {
                    strengths.add("Polling rate cao giup thao tac phan hoi nhanh.");
                }
                if (containsAny(specText, "wireless", "2.4g", "bluetooth")) {
                    strengths.add("Ket noi khong day tien loi cho nhieu boi canh su dung.");
                }
            }
            case HEADPHONE -> {
                if (containsAny(specText, "anc", "noise cancelling", "chong on")) {
                    strengths.add("Co kha nang xu ly on, cai thien trai nghiem nghe.");
                }
                if (containsAny(specText, "7.1", "surround", "spatial")) {
                    strengths.add("Ho tro khong gian am thanh phu hop game/giai tri.");
                }
                if (containsAny(specText, "low latency", "do tre thap")) {
                    strengths.add("Do tre am thanh thap, phu hop nhu cau real-time.");
                }
            }
            case NETWORK -> {
                if (containsAny(specText, "wifi 6", "wifi6", "wifi 6e", "wifi6e", "wifi 7", "wifi7")) {
                    strengths.add("Chuan Wi-Fi moi, loi the cho bang thong va do tre.");
                }
                if (containsAny(specText, "mesh", "mu-mimo", "ofdma")) {
                    strengths.add("Tinh nang mang nang cao giup toi uu vung phu song.");
                }
                if (containsAny(specText, "2.5g", "gigabit", "1gbps")) {
                    strengths.add("Cong ket noi toc do cao, phu hop internet nhanh.");
                }
            }
            default -> {
                if (specCount >= 4) {
                    strengths.add("San pham co nhieu thong so thuc dung de so sanh trong tam gia.");
                }
            }
        }

        String normalizedUseCase = normalizeUseCaseKey(useCase);
        if ("gaming".equals(normalizedUseCase)
                && containsAny(specText, "low latency", "1000hz", "120hz", "144hz", "7.1")) {
            strengths.add("Co cac thong so uu tien do phan hoi cho nhu cau gaming.");
        }

        if (strengths.isEmpty()) {
            strengths.add("Thong so co ban dap ung duoc nhu cau su dung thong thuong.");
        }
        return strengths.stream().limit(MAX_BULLET_ITEMS).toList();
    }

    private List<String> buildNonLaptopWeaknesses(Product product, String useCase, ProductType productType) {
        List<String> specLines = collectSpecLines(product);
        String specText = normalizeMatchText(String.join(" ", specLines));
        int specCount = specLines.size();
        String normalizedUseCase = normalizeUseCaseKey(useCase);
        List<String> weaknesses = new ArrayList<>();

        if (specCount <= 2) {
            weaknesses.add("Thong so ky thuat con it, do tin cay phan tich bi han che.");
        }

        switch (productType) {
            case MONITOR -> {
                if (!containsAny(specText, "hz")) {
                    weaknesses.add("Chua thay ro tan so quet man hinh.");
                }
                if ("gaming".equals(normalizedUseCase)
                        && !containsAny(specText, "120hz", "144hz", "165hz", "240hz")) {
                    weaknesses.add("Nhu cau gaming can tan so quet cao hon de trai nghiem muot.");
                }
                if (("design".equals(normalizedUseCase) || "video".equals(normalizedUseCase))
                        && !containsAny(specText, "ips", "oled", "dci-p3", "adobe", "srgb")) {
                    weaknesses.add("Chua thay thong so mau sac ro rang cho nhu cau sang tao noi dung.");
                }
            }
            case KEYBOARD -> {
                if (!containsAny(specText, "switch", "mechanical", "membrane")) {
                    weaknesses.add("Chua ro loai switch/phim, kho danh gia trai nghiem go.");
                }
                if ("gaming".equals(normalizedUseCase) && !containsAny(specText, "anti-ghost", "nkro", "1000hz")) {
                    weaknesses.add("Thieu thong so gaming then chot nhu anti-ghosting/polling.");
                }
            }
            case MOUSE -> {
                if (!containsAny(specText, "dpi", "cpi", "sensor", "paw", "hero")) {
                    weaknesses.add("Chua ro thong so sensor va dpi/cpi.");
                }
                if ("gaming".equals(normalizedUseCase) && !containsAny(specText, "1000hz", "2000hz", "4000hz")) {
                    weaknesses.add("Polling rate chua ro cho nhu cau gaming.");
                }
            }
            case HEADPHONE -> {
                if (!containsAny(specText, "driver", "hz", "ohm")) {
                    weaknesses.add("Thieu thong so am thanh cot loi (driver/frequency/impedance).");
                }
                if ("gaming".equals(normalizedUseCase) && !containsAny(specText, "low latency", "2.4g", "7.1")) {
                    weaknesses.add("Do tre/dinh huong am thanh cho gaming chua ro.");
                }
            }
            case NETWORK -> {
                if (!containsAny(specText, "wifi 5", "wifi 6", "wifi6", "wifi 6e", "wifi6e", "wifi 7", "wifi7")) {
                    weaknesses.add("Chua ro chuan Wi-Fi, kho uoc luong hieu nang mang.");
                }
                if (!containsAny(specText, "lan", "wan", "gigabit", "2.5g")) {
                    weaknesses.add("Chua thay thong so cong ket noi LAN/WAN.");
                }
            }
            default -> {
                if (specCount <= 3) {
                    weaknesses.add("Can bo sung them thong so de phan tich sat nhu cau hon.");
                }
            }
        }

        if (weaknesses.isEmpty()) {
            weaknesses.add("Khong co diem yeu ro rang, nhung nen doi chieu them test thuc te.");
        }
        return weaknesses.stream().limit(MAX_BULLET_ITEMS).toList();
    }

    private int estimateNonLaptopScore(Product product, String useCase, ProductType productType) {
        List<String> specLines = collectSpecLines(product);
        String specText = normalizeMatchText(String.join(" ", specLines));
        int specCount = specLines.size();
        String normalizedUseCase = normalizeUseCaseKey(useCase);
        int score = 5;

        if (specCount >= 6) {
            score += 1;
        } else if (specCount <= 2) {
            score -= 2;
        }

        switch (productType) {
            case MONITOR -> {
                score += containsAny(specText, "120hz", "144hz", "165hz", "240hz") ? 2 : 0;
                score += containsAny(specText, "ips", "oled", "mini led", "qled") ? 1 : 0;
                score += containsAny(specText, "2k", "qhd", "4k", "uhd") ? 1 : 0;
            }
            case KEYBOARD -> {
                score += containsAny(specText, "switch", "mechanical") ? 1 : 0;
                score += containsAny(specText, "hot swap", "hotswap", "gasket", "pbt") ? 1 : 0;
                score += containsAny(specText, "wireless", "bluetooth", "2.4g") ? 1 : 0;
            }
            case MOUSE -> {
                score += containsAny(specText, "paw", "hero", "sensor") ? 1 : 0;
                score += containsAny(specText, "1000hz", "2000hz", "4000hz", "8000hz") ? 1 : 0;
                score += containsAny(specText, "wireless", "2.4g", "bluetooth") ? 1 : 0;
            }
            case HEADPHONE -> {
                score += containsAny(specText, "anc", "noise cancelling", "chong on") ? 1 : 0;
                score += containsAny(specText, "7.1", "surround", "spatial") ? 1 : 0;
                score += containsAny(specText, "low latency", "do tre thap") ? 1 : 0;
            }
            case NETWORK -> {
                score += containsAny(specText, "wifi 6", "wifi6", "wifi 6e", "wifi6e", "wifi 7", "wifi7") ? 2 : 0;
                score += containsAny(specText, "mesh", "mu-mimo", "ofdma") ? 1 : 0;
                score += containsAny(specText, "gigabit", "2.5g", "1gbps") ? 1 : 0;
            }
            default -> score += specCount >= 4 ? 1 : 0;
        }

        if ("gaming".equals(normalizedUseCase)) {
            score += containsAny(specText, "low latency", "1000hz", "120hz", "144hz", "7.1") ? 1 : -1;
        } else if ("design".equals(normalizedUseCase) || "video".equals(normalizedUseCase)) {
            score += containsAny(specText, "ips", "oled", "dci-p3", "adobe", "srgb", "2k", "4k") ? 1 : -1;
        } else if ("office".equals(normalizedUseCase) || "study".equals(normalizedUseCase)) {
            score += containsAny(specText, "wireless", "bluetooth", "flicker", "eyesafe") ? 1 : 0;
        }

        return sanitizeScore(score, 5);
    }

    private String buildNonLaptopScoreReason(Product product, String useCase, int score, ProductType productType) {
        return "Diem duoc uoc tinh theo nhom " + productTypeLabel(productType).toLowerCase(Locale.ROOT)
                + " va do day du thong so (" + collectSpecLines(product).size() + " dau muc). "
                + "Thong so noibat: " + nonLaptopSpecSnapshot(product)
                + ". Ket qua " + score + "/10 cho muc dich " + useCaseLabel(useCase).toLowerCase(Locale.ROOT) + ".";
    }

    private String buildNonLaptopRecommendation(String useCase, int score, ProductType productType) {
        String purpose = useCaseLabel(useCase).toLowerCase(Locale.ROOT);
        if (score >= 8) {
            return "Phu hop tot cho nhu cau " + purpose + " trong nhom " + productTypeLabel(productType).toLowerCase(Locale.ROOT) + ".";
        }
        if (score >= 6) {
            return "Dat muc kha cho nhu cau " + purpose + ", nen doi chieu them thong so chuyen sau truoc khi chot.";
        }
        return "Chua toi uu cho nhu cau " + purpose + ", nen uu tien mau co thong so sat tieu chi hon.";
    }

    private String buildNonLaptopDetailedEvaluation(Product product, String useCase, int score, ProductType productType) {
        return "Danh gia cho nhom " + productTypeLabel(productType).toLowerCase(Locale.ROOT)
                + " theo nhu cau " + useCaseLabel(useCase).toLowerCase(Locale.ROOT)
                + " duoc tong hop tu thong so co san. "
                + "Noi bat: " + nonLaptopSpecSnapshot(product)
                + ". Tong diem " + score + "/10.";
    }

    private List<String> buildNonLaptopPredictedPerformance(Product product, String useCase, int score, ProductType productType) {
        String normalizedUseCase = normalizeUseCaseKey(useCase);
        List<String> out = new ArrayList<>();

        switch (productType) {
            case MONITOR -> {
                out.add(score >= 8
                        ? "Hinh anh hien thi muot va do net tot cho tac vu theo muc dich da chon."
                        : "Hien thi dap ung nhu cau co ban, tac vu nang can thong so cao hon.");
                out.add("Trai nghiem thuc te phu thuoc them vao cong ket noi va cai dat mau.");
            }
            case KEYBOARD -> {
                out.add(score >= 8
                        ? "Trai nghiem go/on-phim on dinh cho su dung dai thoi gian."
                        : "Su dung co ban on, nhung can doi chieu cam giac phim truc tiep.");
                if ("gaming".equals(normalizedUseCase)) {
                    out.add("Do phan hoi khi game phu thuoc switch va polling rate thuc te.");
                }
            }
            case MOUSE -> {
                out.add(score >= 8
                        ? "Tracking va do tre du kien tot cho thao tac nhanh."
                        : "Tracking du dung hang ngay, game can kiem tra them sensor.");
                out.add("Do thoai mai phu thuoc kich thuoc tay va cach cam.");
            }
            case HEADPHONE -> {
                out.add(score >= 8
                        ? "Am thanh va su thoai mai dat muc kha/tot cho su dung thuong xuyen."
                        : "Dap ung nghe co ban, nhu cau chuyen sau nen nghe thu truc tiep.");
                out.add("Chat luong mic va do tre can test trong moi truong thuc.");
            }
            case NETWORK -> {
                out.add(score >= 8
                        ? "Ket noi du kien on dinh cho nhieu thiet bi dong thoi."
                        : "Ket noi co ban on, tai cao can toi uu vi tri va cau hinh.");
                out.add("Do phu song thuc te phu thuoc vat can va mat do thiet bi.");
            }
            default -> {
                out.add(score >= 8
                        ? "Hieu qua su dung thuc te du kien o muc tot trong tam gia."
                        : "Hieu qua su dung o muc trung binh, nen doi chieu them mau cung tam gia.");
            }
        }

        out.add("Hieu nang thuc te co the thay doi theo he thong ghep noi va dieu kien su dung.");
        return out.stream().limit(MAX_BULLET_ITEMS).toList();
    }

    private String buildNonLaptopConclusion(String useCase, int score, ProductType productType) {
        String purpose = useCaseLabel(useCase).toLowerCase(Locale.ROOT);
        String group = productTypeLabel(productType).toLowerCase(Locale.ROOT);
        if (score >= 8) {
            return "San pham thuoc nhom " + group + " nay phu hop tot cho nhu cau " + purpose + ".";
        }
        if (score >= 6) {
            return "San pham nhom " + group + " dap ung duoc nhu cau " + purpose + " o muc kha.";
        }
        return "San pham nhom " + group + " chua phu hop cho nhu cau " + purpose + ", nen so sanh them lua chon khac.";
    }

    private String nonLaptopSpecSnapshot(Product product) {
        List<String> lines = collectSpecLines(product);
        if (lines.isEmpty()) {
            return "chua co thong so noi bat";
        }
        List<String> compact = new ArrayList<>();
        for (String line : lines) {
            String clean = safe(line);
            if (clean.isBlank()) {
                continue;
            }
            compact.add(clean);
            if (compact.size() >= 3) {
                break;
            }
        }
        return compact.isEmpty() ? "chua co thong so noi bat" : String.join("; ", compact);
    }

    private String normalizedTypeFingerprint(Product product) {
        if (product == null) {
            return "";
        }
        String categoryName = product.getCategory() == null ? "" : safe(product.getCategory().getName());
        String raw = categoryName + " " + safe(product.getName());
        String normalized = Normalizer.normalize(raw, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^\\p{ASCII}]", " ");
        return normalized.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private boolean containsAny(String text, String... tokens) {
        if (text == null || text.isBlank() || tokens == null || tokens.length == 0) {
            return false;
        }
        for (String token : tokens) {
            if (token != null && !token.isBlank() && text.contains(token.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private String normalizeMatchText(String raw) {
        return safe(raw).toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isBlank();
    }
}
