package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.AddCartItemRequest;
import com.techstore1.techstore1.dto.CartResponse;
import com.techstore1.techstore1.dto.UpdateCartQuantityRequest;
import com.techstore1.techstore1.service.CartService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customer/cart")
public class CustomerCartController {

    private final CartService cartService;

    public CustomerCartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    public CartResponse myCart(Authentication authentication) {
        return cartService.getCart(authentication.getName());
    }

    @PostMapping("/items")
    public CartResponse addItem(
            @Valid @RequestBody AddCartItemRequest request,
            Authentication authentication
    ) {
        return cartService.addItem(authentication.getName(), request);
    }

    @PutMapping("/items/{productId}")
    public CartResponse updateItemQuantity(
            @PathVariable Long productId,
            @RequestParam(required = false) Long variantId,
            @Valid @RequestBody UpdateCartQuantityRequest request,
            Authentication authentication
    ) {
        return cartService.setItemQuantity(authentication.getName(), productId, variantId, request);
    }

    @DeleteMapping("/items/{productId}")
    public CartResponse removeItem(
            @PathVariable Long productId,
            @RequestParam(required = false) Long variantId,
            Authentication authentication
    ) {
        return cartService.removeItem(authentication.getName(), productId, variantId);
    }

    @DeleteMapping
    public CartResponse clear(Authentication authentication) {
        return cartService.clearCart(authentication.getName());
    }

}
