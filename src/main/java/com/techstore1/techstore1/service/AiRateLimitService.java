package com.techstore1.techstore1.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AiRateLimitService {

    private final int maxRequests;
    private final long windowMillis;
    private final ConcurrentHashMap<String, Deque<Long>> windows = new ConcurrentHashMap<>();

    public AiRateLimitService(
            @Value("${app.ai.rate-limit.max-requests:8}") int maxRequests,
            @Value("${app.ai.rate-limit.window-seconds:600}") long windowSeconds
    ) {
        this.maxRequests = maxRequests;
        this.windowMillis = Math.max(1L, windowSeconds) * 1000L;
    }

    public void checkLimitOrThrow(String actorKey) {
        if (maxRequests <= 0) {
            // Value <= 0 means unlimited requests (not recommended for production).
            return;
        }

        String key = normalizeActorKey(actorKey);
        long now = System.currentTimeMillis();
        Deque<Long> queue = windows.computeIfAbsent(key, ignored -> new ArrayDeque<>());

        synchronized (queue) {
            // Remove timestamps outside the active window.
            while (!queue.isEmpty() && now - queue.peekFirst() > windowMillis) {
                queue.pollFirst();
            }

            if (queue.size() >= maxRequests) {
                long oldest = queue.peekFirst() == null ? now : queue.peekFirst();
                long retryAfterSeconds = Math.max(1L, (windowMillis - (now - oldest) + 999L) / 1000L);
                throw new IllegalArgumentException(
                        "Bạn đang gửi quá nhiều yêu cầu AI. Vui lòng thử lại sau " + retryAfterSeconds + " giây."
                );
            }

            queue.addLast(now);
        }
    }

    private String normalizeActorKey(String actorKey) {
        String value = actorKey == null ? "" : actorKey.trim().toLowerCase(Locale.ROOT);
        if (value.isBlank()) {
            return "unknown";
        }
        return value;
    }
}
