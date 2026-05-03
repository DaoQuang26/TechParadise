package com.techstore1.techstore1;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
// tac dung code: bat scheduler toan cuc cho cac job nen (vi du auto huy don het han giu hang).
public class Techstore1Application {

    public static void main(String[] args) {
        SpringApplication.run(Techstore1Application.class, args);
    }

}
