package com.techstore1.techstore1.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SupportMessageRequest {

    @NotBlank(message = "Vui lòng nhập nội dung tin nhắn.")
    @Size(max = 4000, message = "Tin nhắn quá dài (tối đa 4000 ký tự).")
    private String content;
}
