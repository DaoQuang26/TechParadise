package com.techstore1.techstore1.enums;

public enum Role {

    SUPER_ADMIN,
    ADMIN,
    CUSTOMER;

    public String asAuthority() {
        return "ROLE_" + name();
    }

}
