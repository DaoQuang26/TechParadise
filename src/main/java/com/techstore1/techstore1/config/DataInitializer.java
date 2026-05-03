package com.techstore1.techstore1.config;

import com.techstore1.techstore1.entity.Category;
import com.techstore1.techstore1.entity.Order;
import com.techstore1.techstore1.entity.OrderItem;
import com.techstore1.techstore1.entity.OrderStatusHistory;
import com.techstore1.techstore1.entity.Product;
import com.techstore1.techstore1.entity.Promotion;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.enums.OrderStatus;
import com.techstore1.techstore1.enums.PaymentGatewayProvider;
import com.techstore1.techstore1.enums.PaymentMethod;
import com.techstore1.techstore1.enums.Role;
import com.techstore1.techstore1.repository.CategoryRepository;
import com.techstore1.techstore1.repository.OrderRepository;
import com.techstore1.techstore1.repository.OrderStatusHistoryRepository;
import com.techstore1.techstore1.repository.ProductRepository;
import com.techstore1.techstore1.repository.PromotionRepository;
import com.techstore1.techstore1.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private static final String SEEDED_DESCRIPTION_MARKER = "seeded automatically for testing/demo";
    private static final String SEEDED_CUSTOMER_PREFIX = "seed_customer_";
    private static final String SEEDED_ORDER_REFERENCE_PREFIX = "SEED-ORDER-";
    private static final String ACCESSORY_CATEGORY_KEY = "phukien";
    private static final String DEPRECATED_PHONE_CATEGORY_KEY = "dienthoai";
    // Category set aligned with common GearVN departments for richer storefront data.
    private static final List<SeedCategoryProfile> DEFAULT_SEED_CATEGORIES = List.of(
            new SeedCategoryProfile("Laptop", "Laptop gaming, office, ultrabook"),
            new SeedCategoryProfile("Bàn phím", "Bàn phím cơ, gaming, văn phòng"),
            new SeedCategoryProfile("Chuột", "Chuột gaming, công thái học, wireless"),
            new SeedCategoryProfile("Tai nghe", "Tai nghe gaming, Bluetooth, studio"),
            new SeedCategoryProfile("Màn hình", "Màn hình gaming, đồ họa, văn phòng"),
            new SeedCategoryProfile("Linh kiện PC", "CPU, VGA, RAM, mainboard, SSD"),
            new SeedCategoryProfile("Thiết bị mạng", "Router, mesh, access point"),
            new SeedCategoryProfile("Phụ kiện", "Cáp, dock, hub, pin dự phòng, loa")
    );
    private static final List<SeedCustomerProfile> DEFAULT_SEED_CUSTOMERS = List.of(
            new SeedCustomerProfile("nguyen.minh.an", "an.nguyen.minh@gmail.com", "0903123456", "126 Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh"),
            new SeedCustomerProfile("tran.thu.linh", "linh.tran.thu@gmail.com", "0912233445", "89 Lê Lợi, Hải Châu, Đà Nẵng"),
            new SeedCustomerProfile("le.hoang.phuc", "phuc.le.hoang@gmail.com", "0934455667", "205 Nguyễn Văn Linh, Ninh Kiều, Cần Thơ"),
            new SeedCustomerProfile("pham.quynh.nhu", "nhu.pham.quynh@gmail.com", "0967788991", "42 Cách Mạng Tháng Tám, Ninh Kiều, Cần Thơ"),
            new SeedCustomerProfile("vo.gia.huy", "huy.vo.gia@gmail.com", "0971122334", "18 Trần Phú, Ngô Quyền, Hải Phòng"),
            new SeedCustomerProfile("bui.khanh.van", "van.bui.khanh@gmail.com", "0983344556", "75 Võ Thị Sáu, Quy Nhơn, Bình Định"),
            new SeedCustomerProfile("do.ngoc.han", "han.do.ngoc@gmail.com", "0905566778", "14 Nguyễn Thị Minh Khai, Nha Trang, Khánh Hòa"),
            new SeedCustomerProfile("dang.minh.khoa", "khoa.dang.minh@gmail.com", "0916677889", "311 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh"),
            new SeedCustomerProfile("truong.hai.yen", "yen.truong.hai@gmail.com", "0937788990", "56 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội"),
            new SeedCustomerProfile("hoang.duc.long", "long.hoang.duc@gmail.com", "0948899001", "23 Phạm Hùng, Nam Từ Liêm, Hà Nội"),
            new SeedCustomerProfile("ngo.thanh.ha", "ha.ngo.thanh@gmail.com", "0959900112", "109 Nguyễn Văn Cừ, Long Biên, Hà Nội"),
            new SeedCustomerProfile("duong.tuan.anh", "anh.duong.tuan@gmail.com", "0961011223", "61 Bạch Đằng, Hải Châu, Đà Nẵng"),
            new SeedCustomerProfile("phan.thao.my", "my.phan.thao@gmail.com", "0972122334", "88 Lê Thánh Tôn, Quận 1, TP. Hồ Chí Minh"),
            new SeedCustomerProfile("ly.quoc.dat", "dat.ly.quoc@gmail.com", "0983233445", "177 Hồ Tùng Mậu, Bắc Từ Liêm, Hà Nội"),
            new SeedCustomerProfile("mai.tam.nhi", "nhi.mai.tam@gmail.com", "0904344556", "31 Nguyễn Tất Thành, Thanh Khê, Đà Nẵng"),
            new SeedCustomerProfile("vu.minh.tri", "tri.vu.minh@gmail.com", "0915455667", "22 Hùng Vương, Quy Nhơn, Bình Định"),
            new SeedCustomerProfile("cao.thien.phu", "phu.cao.thien@gmail.com", "0926566778", "67 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng"),
            new SeedCustomerProfile("lam.bao.chau", "chau.lam.bao@gmail.com", "0937677889", "93 Nguyễn Trãi, Thanh Xuân, Hà Nội"),
            new SeedCustomerProfile("ta.huu.nghi", "nghi.ta.huu@gmail.com", "0948788990", "145 Âu Cơ, Tây Hồ, Hà Nội"),
            new SeedCustomerProfile("dinh.thuy.tien", "tien.dinh.thuy@gmail.com", "0959899001", "12 Ngô Quyền, Ninh Kiều, Cần Thơ")
    );

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final PromotionRepository promotionRepository;
    private final OrderRepository orderRepository;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;
    private volatile Boolean legacyBankTransferEnumColumn;

    @Value("${app.super-admin.username:superadmin}")
    private String superAdminUsername;

    @Value("${app.super-admin.email:superadmin@techstore.local}")
    private String superAdminEmail;

    @Value("${app.super-admin.password:SuperAdmin@123}")
    private String superAdminPassword;

    @Value("${app.admin.username:admin}")
    private String adminUsername;

    @Value("${app.admin.email:admin@techstore.local}")
    private String adminEmail;

    @Value("${app.admin.password:Admin@123}")
    private String adminPassword;

    @Value("${app.seed.products.enabled:true}")
    private boolean seedProductsEnabled;

    @Value("${app.seed.products-per-category:50}")
    private int seedProductsPerCategory;

    @Value("${app.seed.customers.enabled:true}")
    private boolean seedCustomersEnabled;

    @Value("${app.seed.customers.count:12}")
    private int seedCustomersCount;

    @Value("${app.seed.customers.password:123456}")
    private String seedCustomerPassword;

    @Value("${app.seed.orders.enabled:true}")
    private boolean seedOrdersEnabled;

    @Value("${app.seed.orders.count:240}")
    private int seedOrdersCount;

    @Value("${app.seed.orders.days-back:120}")
    private int seedOrdersDaysBack;

    @Value("${app.seed.orders.days-forward:45}")
    private int seedOrdersDaysForward;

    @Value("${app.seed.orders.extra-per-run:80}")
    private int seedOrdersExtraPerRun;

    public DataInitializer(
            UserRepository userRepository,
            CategoryRepository categoryRepository,
            ProductRepository productRepository,
            PromotionRepository promotionRepository,
            OrderRepository orderRepository,
            OrderStatusHistoryRepository orderStatusHistoryRepository,
            PasswordEncoder passwordEncoder,
            JdbcTemplate jdbcTemplate
    ) {
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.promotionRepository = promotionRepository;
        this.orderRepository = orderRepository;
        this.orderStatusHistoryRepository = orderStatusHistoryRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        // Bootstraps privileged accounts and sample catalog data on startup.
        initSuperAdmin();
        initAdmin();
        normalizeSeedCategoryNames();
        removeDeprecatedPhoneCategories();
        ensureProductIdsStartFromOne();
        widenProductDescriptionColumnIfNeeded();
        backfillLegacyCartVariantKeys();
        backfillLegacyOrderItemVariantKeys();
        migrateCartItemVariantUniqueConstraint();
        initCategoriesAndProducts();
        initPromotions();
        List<User> seededCustomers = initCustomerUsers();
        initSampleOrdersForDashboard(seededCustomers);
        backfillLegacyProductVersion();
    }

    public int seedSampleOrdersNow() {
        List<User> seededCustomers = initCustomerUsers();
        return initSampleOrdersForDashboard(seededCustomers);
    }

    private void initSuperAdmin() {
        upsertPrivilegedUser(
                superAdminUsername,
                superAdminEmail,
                superAdminPassword,
                Role.SUPER_ADMIN,
                "0900000000",
                "TP. Ho Chi Minh"
        );
    }

    private void initAdmin() {
        // Avoid conflicting config where admin username equals superadmin username.
        if (adminUsername != null && superAdminUsername != null
                && adminUsername.trim().equalsIgnoreCase(superAdminUsername.trim())) {
            return;
        }

        upsertPrivilegedUser(
                adminUsername,
                adminEmail,
                adminPassword,
                Role.ADMIN,
                "0911111111",
                "Ha Noi"
        );
    }

    private void upsertPrivilegedUser(
            String rawUsername,
            String rawEmail,
            String rawPassword,
            Role role,
            String defaultPhone,
            String defaultAddress
    ) {
        String username = normalizeRequired(rawUsername, "username");
        String email = normalizeRequired(rawEmail, "email").toLowerCase(Locale.ROOT);
        String password = normalizeRequired(rawPassword, "password");

        User existing = userRepository.findByUsernameIgnoreCase(username).orElse(null);
        if (existing != null) {
            boolean changed = false;

            if (existing.getRole() != role) {
                existing.setRole(role);
                changed = true;
            }

            if (!email.equalsIgnoreCase(existing.getEmail())) {
                existing.setEmail(email);
                changed = true;
            }

            boolean needUpgrade = existing.getPassword() == null || passwordEncoder.upgradeEncoding(existing.getPassword());
            boolean notMatch = existing.getPassword() == null || !passwordEncoder.matches(password, existing.getPassword());
            if (needUpgrade || notMatch) {
                existing.setPassword(passwordEncoder.encode(password));
                changed = true;
            }

            if (isBlank(existing.getPhone())) {
                existing.setPhone(defaultPhone);
                changed = true;
            }

            if (isBlank(existing.getAddress())) {
                existing.setAddress(defaultAddress);
                changed = true;
            }

            // Keep seeded admin accounts always active.
            if (existing.getFailedLoginAttempts() == null || existing.getFailedLoginAttempts() != 0) {
                existing.setFailedLoginAttempts(0);
                changed = true;
            }
            if (existing.getLockoutUntil() != null) {
                existing.setLockoutUntil(null);
                changed = true;
            }

            if (changed) {
                userRepository.save(existing);
            }
            return;
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(role);
        user.setPhone(defaultPhone);
        user.setAddress(defaultAddress);
        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        userRepository.save(user);
    }

    private void initCategoriesAndProducts() {
        if (!seedProductsEnabled) {
            return;
        }

        int targetPerCategory = Math.max(0, seedProductsPerCategory);
        if (targetPerCategory <= 0) {
            return;
        }

        List<Category> categories = ensureSeedCategories(categoryRepository.findAll());

        int totalCreated = 0;
        int totalRefreshed = 0;
        for (Category category : categories) {
            if (category.getId() == null) {
                continue;
            }

            List<Product> existingProducts = productRepository.findByCategoryId(category.getId());
            int refreshed = refreshSeededProductsForCategory(category, existingProducts);
            if (refreshed > 0) {
                totalRefreshed += refreshed;
                log.info("Refreshed {} seeded products for category {}", refreshed, category.getName());
            }

            long currentCount = productRepository.countByCategoryId(category.getId());
            if (currentCount >= targetPerCategory) {
                continue;
            }

            int toCreate = (int) (targetPerCategory - currentCount);
            int startIndex = (int) currentCount + 1;
            List<Product> batch = new ArrayList<>(toCreate);
            for (int i = 0; i < toCreate; i++) {
                batch.add(createGeneratedProduct(category, startIndex + i));
            }

            productRepository.saveAll(batch);
            totalCreated += batch.size();
            log.info("Seeded {} products for category {}", batch.size(), category.getName());
        }

        if (totalCreated > 0) {
            log.info("Product seed completed. Added {} products.", totalCreated);
        }
        if (totalRefreshed > 0) {
            log.info("Product seed completed. Refreshed {} existing seeded products.", totalRefreshed);
        }
    }

    private List<Category> ensureSeedCategories(List<Category> existingCategories) {
        List<Category> current = existingCategories == null ? List.of() : existingCategories;
        List<Category> created = new ArrayList<>();

        for (SeedCategoryProfile profile : DEFAULT_SEED_CATEGORIES) {
            String expectedName = profile.name();
            String expectedKey = normalizeCategoryKey(expectedName);
            boolean exists = current.stream()
                    .filter(category -> category != null && category.getName() != null)
                    .anyMatch(category -> normalizeCategoryKey(category.getName()).equals(expectedKey));
            if (exists) {
                continue;
            }

            Category category = new Category();
            category.setName(expectedName);
            category.setDescription(profile.description());
            created.add(categoryRepository.save(category));
        }

        if (!created.isEmpty()) {
            log.info("Created {} missing catalog categories for seed/import", created.size());
            current = categoryRepository.findAll();
        }

        return current;
    }

    private void normalizeSeedCategoryNames() {
        List<Category> categories = categoryRepository.findAll();
        if (categories.isEmpty()) {
            return;
        }

        boolean changed = false;
        for (Category category : categories) {
            if (category == null || category.getName() == null) {
                continue;
            }

            String rawName = category.getName().trim();
            if (normalizeCategoryKey(rawName).contains(DEPRECATED_PHONE_CATEGORY_KEY)) {
                continue;
            }
            if (rawName.equalsIgnoreCase("Dien thoai")) {
                category.setName("Điện thoại");
                if (isBlank(category.getDescription())) {
                    category.setDescription("Smartphone cao cấp và tầm trung");
                }
                changed = true;
                continue;
            }

            if (rawName.equalsIgnoreCase("Phu kien")) {
                category.setName("Phụ kiện");
                if (isBlank(category.getDescription())) {
                    category.setDescription("Tai nghe, bàn phím, chuột, loa");
                }
                changed = true;
            }
        }

        if (changed) {
            categoryRepository.saveAll(categories);
        }
    }

    private void removeDeprecatedPhoneCategories() {
        List<Category> categories = categoryRepository.findAll();
        if (categories.isEmpty()) {
            return;
        }

        List<Category> deprecatedPhoneCategories = categories.stream()
                .filter(this::isDeprecatedPhoneCategory)
                .toList();
        if (deprecatedPhoneCategories.isEmpty()) {
            return;
        }

        Category fallbackCategory = categories.stream()
                .filter(category -> category != null && category.getName() != null)
                .filter(category -> ACCESSORY_CATEGORY_KEY.equals(normalizeCategoryKey(category.getName())))
                .findFirst()
                .orElseGet(this::createFallbackAccessoryCategory);

        int migratedProducts = 0;
        for (Category deprecatedCategory : deprecatedPhoneCategories) {
            if (deprecatedCategory == null || deprecatedCategory.getId() == null) {
                continue;
            }

            List<Product> products = productRepository.findByCategoryId(deprecatedCategory.getId());
            if (!products.isEmpty()) {
                for (Product product : products) {
                    product.setCategory(fallbackCategory);
                }
                productRepository.saveAll(products);
                migratedProducts += products.size();
            }

            categoryRepository.delete(deprecatedCategory);
        }

        log.info(
                "Removed {} deprecated phone categories and migrated {} products to {}",
                deprecatedPhoneCategories.size(),
                migratedProducts,
                fallbackCategory.getName()
        );
    }

    private boolean isDeprecatedPhoneCategory(Category category) {
        if (category == null || category.getName() == null) {
            return false;
        }
        String key = normalizeCategoryKey(category.getName());
        return key.contains(DEPRECATED_PHONE_CATEGORY_KEY) || key.contains("smartphone");
    }

    private Category createFallbackAccessoryCategory() {
        Category category = new Category();
        category.setName("Phu kien");
        category.setDescription("Accessory fallback category for deprecated phone products");
        return categoryRepository.save(category);
    }

    private int refreshSeededProductsForCategory(Category category, List<Product> existingProducts) {
        if (category == null || existingProducts == null || existingProducts.isEmpty()) {
            return 0;
        }

        List<Product> seededProducts = existingProducts.stream()
                .filter(this::isAutoSeededProduct)
                .sorted(Comparator.comparing(Product::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        if (seededProducts.isEmpty()) {
            return 0;
        }

        int sequence = 1;
        for (Product seeded : seededProducts) {
            Product generated = createGeneratedProduct(category, sequence++);
            copySeedProductData(seeded, generated);
        }
        productRepository.saveAll(seededProducts);
        return seededProducts.size();
    }

    private boolean isAutoSeededProduct(Product product) {
        if (product == null) {
            return false;
        }
        String description = product.getDescription() == null ? "" : product.getDescription().toLowerCase(Locale.ROOT);
        return description.contains(SEEDED_DESCRIPTION_MARKER);
    }

    private void copySeedProductData(Product target, Product source) {
        if (target == null || source == null) {
            return;
        }

        target.setName(source.getName());
        target.setDescription(source.getDescription());
        target.setPrice(source.getPrice());
        target.setDiscountPercent(source.getDiscountPercent());
        target.setStock(source.getStock());
        target.setImageUrl(source.getImageUrl());
        target.setGalleryImages(source.getGalleryImages());
        target.setQuickSpecs(source.getQuickSpecs());
        target.setDetailSpecs(source.getDetailSpecs());
        target.setCpu(source.getCpu());
        target.setRam(source.getRam());
        target.setStorage(source.getStorage());
        target.setGpu(source.getGpu());
        target.setScreen(source.getScreen());
        target.setBattery(source.getBattery());
        target.setCamera(source.getCamera());
        target.setOperatingSystem(source.getOperatingSystem());
    }

    private Product createSampleProduct(
            String name,
            String description,
            Double price,
            Integer stock,
            String imageUrl,
            String galleryImages,
            String quickSpecs,
            String detailSpecs,
            Category category
    ) {
        Product product = new Product();
        product.setName(name);
        product.setDescription(description);
        product.setPrice(price);
        product.setDiscountPercent(0D);
        product.setStock(stock);
        product.setImageUrl(imageUrl);
        product.setGalleryImages(galleryImages);
        product.setQuickSpecs(quickSpecs);
        product.setDetailSpecs(detailSpecs);
        product.setCategory(category);
        return product;
    }

    private Product createGeneratedProduct(Category category, int sequence) {
        String categoryName = category.getName() == null || category.getName().isBlank()
                ? "Category"
                : category.getName().trim();
        String categoryKey = normalizeCategoryKey(categoryName);

        boolean isLaptop = categoryKey.contains("laptop") || categoryKey.contains("notebook");
        boolean isPhone = categoryKey.contains("dienthoai") || categoryKey.contains("smartphone") || categoryKey.contains("phone");

        String brand;
        String cpu;
        String ram;
        String storage;
        String gpu;
        String screen;
        String battery;
        String camera;
        String operatingSystem;
        String modelName;
        double price;
        int stock;

        if (isLaptop) {
            modelName = pick(sequence,
                    "Dell XPS 13 9340",
                    "ASUS ROG Strix G16",
                    "Lenovo ThinkPad X1 Carbon Gen 12",
                    "HP Spectre x360 14",
                    "Acer Predator Helios Neo 16",
                    "MSI Katana 15",
                    "MacBook Air 13 M3",
                    "MacBook Pro 14 M3 Pro",
                    "ASUS Zenbook 14 OLED",
                    "Dell Inspiron 14 Plus");
            brand = modelName.split(" ")[0];
            cpu = pick(sequence,
                    "Intel Core Ultra 7 155H",
                    "Intel Core i7-13650HX",
                    "Intel Core Ultra 5 125H",
                    "AMD Ryzen 7 8845HS",
                    "Apple M3",
                    "Apple M3 Pro");
            ram = pick(sequence, "16GB", "24GB", "32GB");
            storage = pick(sequence, "512GB SSD", "1TB SSD", "2TB SSD");
            gpu = pick(sequence, "Intel Arc Graphics", "NVIDIA RTX 4050", "NVIDIA RTX 4060", "Apple GPU 10-core");
            screen = pick(sequence, "14 inch OLED 2.8K 120Hz", "15.6 inch FHD+ 165Hz", "16 inch WQXGA 240Hz", "13.6 inch Liquid Retina");
            battery = pick(sequence, "54Wh", "70Wh", "76Wh", "86Wh");
            camera = "1080p";
            operatingSystem = modelName.startsWith("MacBook") ? "macOS" : "Windows 11";
            price = pickDouble(sequence,
                    23990000D, 27990000D, 31990000D, 35990000D, 39990000D, 45990000D
            );
            stock = pickInt(sequence, 5, 7, 8, 10, 12);
        } else if (isPhone) {
            modelName = pick(sequence,
                    "iPhone 15",
                    "iPhone 15 Pro",
                    "Samsung Galaxy S24",
                    "Samsung Galaxy S24 Ultra",
                    "Xiaomi 14",
                    "Xiaomi 14T Pro",
                    "OPPO Reno12 Pro",
                    "vivo X100",
                    "realme GT 6",
                    "Google Pixel 8");
            brand = modelName.split(" ")[0];
            cpu = pick(sequence, "Apple A17 Pro", "Snapdragon 8 Gen 3", "Snapdragon 8s Gen 3", "Dimensity 9300", "Google Tensor G3");
            ram = pick(sequence, "8GB", "12GB", "16GB");
            storage = pick(sequence, "128GB", "256GB", "512GB", "1TB");
            gpu = pick(sequence, "Apple GPU", "Adreno 750", "Immortalis-G720", "Mali-G715");
            screen = pick(sequence, "6.1 inch OLED 120Hz", "6.7 inch OLED 120Hz", "6.8 inch AMOLED 120Hz");
            battery = pick(sequence, "3349mAh", "4500mAh", "5000mAh", "5400mAh");
            camera = pick(sequence, "48MP + 12MP", "50MP + 12MP + 10MP", "200MP + 50MP + 12MP");
            operatingSystem = modelName.startsWith("iPhone") ? "iOS" : "Android";
            price = pickDouble(sequence,
                    11990000D, 14990000D, 17990000D, 21990000D, 25990000D, 29990000D, 34990000D
            );
            stock = pickInt(sequence, 12, 16, 20, 24, 30);
        } else {
            modelName = pick(sequence,
                    "AirPods Pro 2",
                    "Sony WH-1000XM5",
                    "JBL Charge 5",
                    "Logitech MX Master 3S",
                    "Razer DeathAdder V3 Pro",
                    "Keychron K8 Pro",
                    "Anker 737 Power Bank",
                    "Samsung T7 Shield",
                    "Google Chromecast 4K",
                    "TP-Link Archer AX55");
            brand = modelName.split(" ")[0];
            cpu = null;
            ram = pick(sequence, null, null, null, "8GB");
            storage = pick(sequence, null, null, null, "1TB", "2TB");
            gpu = null;
            screen = pick(sequence, null, null, "1.57 inch OLED", null);
            battery = pick(sequence, "24h", "30h", "40h", "5000mAh", "24000mAh");
            camera = null;
            operatingSystem = pick(sequence, "Bluetooth 5.3", "Wi-Fi 6", "USB-C");
            price = pickDouble(sequence, 890000D, 1290000D, 1990000D, 2490000D, 3490000D, 5990000D, 8990000D);
            stock = pickInt(sequence, 15, 20, 30, 45, 60);
        }

        String safeCode = normalizeCategoryKey(modelName);
        if (safeCode.isBlank()) {
            safeCode = categoryKey.isBlank() ? "cat" : categoryKey;
        }
        String code = safeCode + "-" + String.format("%03d", sequence);
        String name;
        if (isAccessoryCategory(categoryKey) || (!isLaptop && !isPhone)) {
            name = modelName + " - Chính hãng VN";
        } else {
            name = modelName + " (" + ram + " / " + storage + ")";
        }

        String description = "Sản phẩm thực tế thuộc danh mục " + categoryName + ", dữ liệu mẫu seeded automatically for testing/demo.";
        String imageUrl = "https://placehold.co/900x700/f1f5f9/0f172a?text=" + code;
        String galleryImages = String.join("\n",
                imageUrl,
                "https://placehold.co/900x700/e2e8f0/0f172a?text=" + code + "-2"
        );

        String quickSpecs = joinSpecLines(
                specLine("CPU/Chip", cpu),
                specLine("RAM", ram),
                specLine("Bộ nhớ", storage),
                specLine("GPU", gpu),
                specLine("Màn hình", screen),
                specLine("Pin", battery),
                specLine("Hệ điều hành", operatingSystem),
                specLine("Thương hiệu", brand)
        );

        String detailSpecs = joinSpecLines(
                specLine("CPU/Chip", cpu),
                specLine("RAM", ram),
                specLine("Bộ nhớ", storage),
                specLine("GPU", gpu),
                specLine("Màn hình", screen),
                specLine("Pin", battery),
                specLine("Camera", camera),
                specLine("Hệ điều hành", operatingSystem),
                specLine("Thương hiệu", brand),
                "Bảo hành: 12 tháng",
                "Tình trạng: Mới 100%"
        );

        Product product = createSampleProduct(
                name,
                description,
                price,
                stock,
                imageUrl,
                galleryImages,
                quickSpecs,
                detailSpecs,
                category
        );
        product.setCpu(cpu);
        product.setRam(ram);
        product.setStorage(storage);
        product.setGpu(gpu);
        product.setScreen(screen);
        product.setBattery(battery);
        product.setCamera(camera);
        product.setOperatingSystem(operatingSystem);
        return product;
    }

    private boolean isAccessoryCategory(String categoryKey) {
        if (categoryKey == null) {
            return false;
        }
        return categoryKey.contains("phukien")
                || categoryKey.contains("accessory")
                || categoryKey.contains("gear");
    }

    private String pick(int sequence, String... values) {
        if (values == null || values.length == 0) {
            return "";
        }
        int index = Math.floorMod(sequence - 1, values.length);
        return values[index] == null ? "" : values[index];
    }

    private double pickDouble(int sequence, double... values) {
        if (values == null || values.length == 0) {
            return 0D;
        }
        int index = Math.floorMod(sequence - 1, values.length);
        return values[index];
    }

    private int pickInt(int sequence, int... values) {
        if (values == null || values.length == 0) {
            return 0;
        }
        int index = Math.floorMod(sequence - 1, values.length);
        return values[index];
    }

    private String specLine(String label, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return label + ": " + value.trim();
    }

    private String joinSpecLines(String... lines) {
        if (lines == null || lines.length == 0) {
            return "";
        }

        StringBuilder out = new StringBuilder();
        for (String line : lines) {
            if (line == null || line.isBlank()) {
                continue;
            }
            if (out.length() > 0) {
                out.append('\n');
            }
            out.append(line.trim());
        }
        return out.toString();
    }

    private String normalizeCategoryKey(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String noAccent = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return noAccent.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private void initPromotions() {
        if (promotionRepository.count() > 0) {
            return;
        }

        Promotion welcome = new Promotion(
                null,
                "WELCOME10",
                10,
                LocalDate.now().minusDays(1),
                LocalDate.now().plusMonths(1),
                Boolean.TRUE
        );
        promotionRepository.save(welcome);
    }

    private List<User> initCustomerUsers() {
        if (!seedCustomersEnabled) {
            return userRepository.findByRole(Role.CUSTOMER);
        }

        int targetCount = Math.max(0, seedCustomersCount);
        if (targetCount <= 0) {
            return userRepository.findByRole(Role.CUSTOMER);
        }

        String rawPassword = normalizeRequired(seedCustomerPassword, "seed customer password");
        List<SeedCustomerProfile> profiles = resolveSeedCustomerProfiles(targetCount);
        List<User> legacySeedCustomers = userRepository.findByRole(Role.CUSTOMER).stream()
                .filter(user -> startsWithIgnoreCase(user.getUsername(), SEEDED_CUSTOMER_PREFIX))
                .sorted(Comparator.comparing(User::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        int created = 0;
        int updated = 0;
        int skipped = 0;
        List<User> seededCustomers = new ArrayList<>(profiles.size());

        for (int i = 0; i < profiles.size(); i++) {
            SeedCustomerProfile profile = profiles.get(i);
            User customer = userRepository.findByUsernameIgnoreCase(profile.username()).orElse(null);
            if (customer == null) {
                customer = userRepository.findByEmailIgnoreCase(profile.email()).orElse(null);
            }
            if (customer == null && i < legacySeedCustomers.size()) {
                customer = legacySeedCustomers.get(i);
            }

            boolean isNew = customer == null;
            if (isNew) {
                customer = new User();
            }

            boolean changed = applySeedCustomerProfile(customer, profile, rawPassword);
            if (isNew || changed) {
                try {
                    customer = userRepository.save(customer);
                    if (isNew) {
                        created++;
                    } else {
                        updated++;
                    }
                } catch (RuntimeException ex) {
                    skipped++;
                    log.warn("Skip customer seed profile {} due to DB issue: {}", profile.username(), ex.getMessage());
                    continue;
                }
            }

            seededCustomers.add(customer);
        }

        if (created > 0 || updated > 0 || skipped > 0) {
            log.info("Seeded customer users. Created: {}, updated: {}, skipped: {}", created, updated, skipped);
        }
        return seededCustomers;
    }

    private List<SeedCustomerProfile> resolveSeedCustomerProfiles(int targetCount) {
        int safeCount = Math.max(0, targetCount);
        List<SeedCustomerProfile> profiles = new ArrayList<>(safeCount);
        int fromDefaults = Math.min(safeCount, DEFAULT_SEED_CUSTOMERS.size());
        profiles.addAll(DEFAULT_SEED_CUSTOMERS.subList(0, fromDefaults));

        for (int i = fromDefaults + 1; i <= safeCount; i++) {
            String suffix = String.format(Locale.ROOT, "%02d", i);
            profiles.add(new SeedCustomerProfile(
                    "khach.hang." + suffix,
                    "khachhang" + suffix + "@gmail.com",
                    String.format(Locale.ROOT, "09%08d", 6_000_000 + i),
                    pick(i,
                            "120 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh",
                            "45 Trần Phú, Hải Châu, Đà Nẵng",
                            "77 Lê Hồng Phong, Ngô Quyền, Hải Phòng",
                            "31 Nguyễn Văn Linh, Ninh Kiều, Cần Thơ",
                            "88 Láng Hạ, Đống Đa, Hà Nội"
                    )
            ));
        }
        return profiles;
    }

    private boolean applySeedCustomerProfile(User customer, SeedCustomerProfile profile, String rawPassword) {
        if (customer == null || profile == null) {
            return false;
        }

        boolean changed = false;
        Long customerId = customer.getId();

        if (customer.getRole() != Role.CUSTOMER) {
            customer.setRole(Role.CUSTOMER);
            changed = true;
        }

        String targetUsername = profile.username();
        if (!equalsIgnoreCase(targetUsername, customer.getUsername())
                && !isUsernameTakenByOther(targetUsername, customerId)) {
            customer.setUsername(targetUsername);
            changed = true;
        }

        String targetEmail = profile.email();
        if (!equalsIgnoreCase(targetEmail, customer.getEmail())
                && !isEmailTakenByOther(targetEmail, customerId)) {
            customer.setEmail(targetEmail);
            changed = true;
        }

        boolean needUpgrade = customer.getPassword() == null || passwordEncoder.upgradeEncoding(customer.getPassword());
        boolean notMatch = customer.getPassword() == null || !passwordEncoder.matches(rawPassword, customer.getPassword());
        if (needUpgrade || notMatch) {
            customer.setPassword(passwordEncoder.encode(rawPassword));
            changed = true;
        }

        if (!equalsIgnoreCase(profile.phone(), customer.getPhone())) {
            customer.setPhone(profile.phone());
            changed = true;
        }
        if (!equalsIgnoreCase(profile.address(), customer.getAddress())) {
            customer.setAddress(profile.address());
            changed = true;
        }
        if (customer.getFailedLoginAttempts() == null || customer.getFailedLoginAttempts() != 0) {
            customer.setFailedLoginAttempts(0);
            changed = true;
        }
        if (customer.getLockoutUntil() != null) {
            customer.setLockoutUntil(null);
            changed = true;
        }
        return changed;
    }

    private boolean isUsernameTakenByOther(String username, Long currentUserId) {
        if (isBlank(username)) {
            return false;
        }
        User existing = userRepository.findByUsernameIgnoreCase(username).orElse(null);
        if (existing == null) {
            return false;
        }
        return currentUserId == null || !currentUserId.equals(existing.getId());
    }

    private boolean isEmailTakenByOther(String email, Long currentUserId) {
        if (isBlank(email)) {
            return false;
        }
        User existing = userRepository.findByEmailIgnoreCase(email).orElse(null);
        if (existing == null) {
            return false;
        }
        return currentUserId == null || !currentUserId.equals(existing.getId());
    }

    private boolean startsWithIgnoreCase(String value, String prefix) {
        if (value == null || prefix == null) {
            return false;
        }
        return value.toLowerCase(Locale.ROOT).startsWith(prefix.toLowerCase(Locale.ROOT));
    }

    private int initSampleOrdersForDashboard(List<User> customers) {
        if (!seedOrdersEnabled) {
            return 0;
        }

        if (customers == null || customers.isEmpty()) {
            return 0;
        }

        List<Product> products = productRepository.findAll().stream()
                .filter(product -> product != null && product.getId() != null)
                .filter(product -> product.getPrice() != null && product.getPrice() > 0D)
                .sorted(Comparator.comparing(Product::getId))
                .toList();
        if (products.isEmpty()) {
            return 0;
        }

        int maxDaysBack = Math.max(30, seedOrdersDaysBack);
        int maxDaysForward = Math.max(0, seedOrdersDaysForward);
        int targetOrders = Math.max(0, seedOrdersCount);
        int extraPerRun = Math.max(0, seedOrdersExtraPerRun);
        LocalDateTime now = LocalDateTime.now();
        String timelineActor = "seed-system";

        int existingSeededCount = 0;
        int maxExistingSequence = 0;
        for (Order existingOrder : orderRepository.findAll()) {
            if (existingOrder == null) {
                continue;
            }
            Integer sequence = parseSeedOrderSequence(existingOrder.getPaymentReference());
            if (sequence == null) {
                continue;
            }
            existingSeededCount++;
            if (sequence > maxExistingSequence) {
                maxExistingSequence = sequence;
            }
        }

        int topUpToTarget = Math.max(0, targetOrders - existingSeededCount);
        int ordersToCreate = topUpToTarget + extraPerRun;
        if (ordersToCreate <= 0) {
            return 0;
        }

        List<SeedOrderDraft> drafts = new ArrayList<>();

        int nextSequence = Math.max(1, maxExistingSequence + 1);
        int guard = 0;
        int maxGuard = Math.max(ordersToCreate * 6, 120);

        while (drafts.size() < ordersToCreate && guard < maxGuard) {
            guard++;
            int index = nextSequence++;
            String paymentReference = SEEDED_ORDER_REFERENCE_PREFIX + String.format(Locale.ROOT, "%04d", index);
            if (orderRepository.findByPaymentReference(paymentReference).isPresent()) {
                continue;
            }

            User customer = customers.get(Math.floorMod(index - 1, customers.size()));
            LocalDateTime createdAt = buildSeedOrderCreatedAt(index, maxDaysBack, maxDaysForward, now);
            OrderStatus status = pickSeedOrderStatus(index, createdAt, now);
            PaymentMethod paymentMethod = normalizePaymentMethodForDatabase(pickSeedPaymentMethod(index));
            boolean onlinePayment = isOnlinePaymentMethod(paymentMethod);

            Order order = new Order();
            order.setUser(customer);
            order.setStatus(status);
            order.setCreatedAt(createdAt);
            order.setShippingAddress(buildSeedShippingAddress(customer, index));
            order.setPaymentMethod(paymentMethod);
            order.setPaymentReference(paymentReference);
            order.setPaymentProvider(onlinePayment ? pickSeedPaymentProvider(index) : null);
            order.setOnlinePaymentStatus(resolveSeedOnlinePaymentStatus(status));

            if (order.getOnlinePaymentStatus() == OnlinePaymentStatus.PAID) {
                LocalDateTime paidAt = createdAt.plusHours(2L + Math.floorMod(index, 36));
                if (paidAt.isBefore(createdAt)) {
                    paidAt = createdAt;
                }
                order.setPaidAt(paidAt);
            } else {
                order.setPaidAt(null);
            }

            // Seeded demo orders can be in past/future; keep reservation null to avoid scheduler auto-cancel side effects.
            order.setReservationExpiresAt(null);

            addSeedOrderItems(order, products, index);
            if (order.getItems().isEmpty()) {
                continue;
            }

            double subtotal = order.getItems().stream()
                    .mapToDouble(item -> {
                        double unitPrice = item.getPrice() == null ? 0D : item.getPrice();
                        int quantity = item.getQuantity() == null ? 0 : item.getQuantity();
                        return unitPrice * quantity;
                    })
                    .sum();
            if (subtotal <= 0D) {
                continue;
            }

            int discountPercent = pickSeedDiscountPercent(index);
            double discountAmount = discountPercent <= 0 ? 0D : Math.round(subtotal * discountPercent / 100D);
            double total = Math.max(0D, subtotal - discountAmount);

            order.setSubtotalPrice(subtotal);
            order.setDiscountPercent(discountPercent <= 0 ? null : discountPercent);
            order.setDiscountAmount(discountAmount);
            order.setPromotionCode(discountPercent >= 10 ? "WELCOME10" : null);
            order.setTotalPrice(total);

            drafts.add(new SeedOrderDraft(order, status, createdAt));
        }

        if (drafts.isEmpty()) {
            return 0;
        }

        int createdCount = 0;
        int skippedCount = 0;
        List<OrderStatusHistory> historyRows = new ArrayList<>();

        for (SeedOrderDraft draft : drafts) {
            try {
                Order savedOrder = saveSeedOrderWithLegacyCharsetFallback(draft.order());
                createdCount++;
                historyRows.addAll(buildSeedStatusTimeline(savedOrder, draft.status(), draft.createdAt(), timelineActor));
            } catch (RuntimeException ex) {
                skippedCount++;
                log.warn("Skip sample order {} due to DB issue: {}", draft.order().getPaymentReference(), ex.getMessage());
            }
        }

        if (createdCount <= 0) {
            return 0;
        }

        try {
            if (!historyRows.isEmpty()) {
                orderStatusHistoryRepository.saveAll(historyRows);
            }
            log.info(
                    "Seeded {} sample orders for dashboard revenue chart (existingSeeded={}, target={}, extraPerRun={}, skipped={})",
                    createdCount,
                    existingSeededCount,
                    targetOrders,
                    extraPerRun,
                    skippedCount
            );
            return createdCount;
        } catch (RuntimeException ex) {
            // Revenue/order seed is best-effort and should never block startup.
            log.warn("Skip sample order seed due to DB issue: {}", ex.getMessage());
            return createdCount;
        }
    }

    private Integer parseSeedOrderSequence(String paymentReference) {
        if (isBlank(paymentReference) || !paymentReference.startsWith(SEEDED_ORDER_REFERENCE_PREFIX)) {
            return null;
        }
        String raw = paymentReference.substring(SEEDED_ORDER_REFERENCE_PREFIX.length()).trim();
        if (raw.isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Order saveSeedOrderWithLegacyCharsetFallback(Order order) {
        try {
            return orderRepository.saveAndFlush(order);
        } catch (RuntimeException ex) {
            if (!isIncorrectStringValue(ex)) {
                throw ex;
            }
            sanitizeSeedOrderForLegacyDatabase(order);
            return orderRepository.saveAndFlush(order);
        }
    }

    private void sanitizeSeedOrderForLegacyDatabase(Order order) {
        if (order == null) {
            return;
        }
        order.setShippingAddress(sanitizeForLegacyDatabase(order.getShippingAddress()));
        order.setPromotionCode(sanitizeForLegacyDatabase(order.getPromotionCode()));
        order.setPaymentReference(sanitizeForLegacyDatabase(order.getPaymentReference()));
        order.setPaymentProvider(sanitizeForLegacyDatabase(order.getPaymentProvider()));
    }

    private boolean isIncorrectStringValue(Throwable throwable) {
        Throwable cursor = throwable;
        while (cursor != null) {
            String message = cursor.getMessage();
            if (message != null) {
                String normalized = message.toLowerCase(Locale.ROOT);
                if (normalized.contains("incorrect string value")
                        || normalized.contains("cannot convert string")
                        || normalized.contains("character set")) {
                    return true;
                }
            }
            cursor = cursor.getCause();
        }
        return false;
    }

    private String sanitizeForLegacyDatabase(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return normalized
                .replace("\u0111", "d")
                .replace("\u0110", "D");
    }

    private void addSeedOrderItems(Order order, List<Product> products, int sequence) {
        if (order == null || products == null || products.isEmpty()) {
            return;
        }

        double wave = seedWaveNormalized(sequence);
        int itemCount = 1 + Math.floorMod(sequence, 3);
        if (wave >= 0.72D) {
            itemCount = Math.min(4, itemCount + 1);
        } else if (wave <= 0.20D) {
            itemCount = Math.max(1, itemCount - 1);
        }

        int waveOffset = (int) Math.round(wave * 31D);
        int startIndex = Math.floorMod((sequence * 7) + (sequence * sequence) + waveOffset, products.size());

        for (int i = 0; i < itemCount; i++) {
            Product product = products.get(Math.floorMod(startIndex + (i * 11), products.size()));
            if (product == null || product.getPrice() == null || product.getPrice() <= 0D) {
                continue;
            }

            int quantity = 1 + Math.floorMod(sequence + i, 2);
            if (wave >= 0.70D && Math.floorMod(sequence + i, 3) != 0) {
                quantity += 1;
            } else if (wave <= 0.18D && quantity > 1) {
                quantity -= 1;
            }

            double basePrice = product.getFinalPrice() == null ? product.getPrice() : product.getFinalPrice();
            double unitPrice = Math.round(basePrice * (0.92D + (wave * 0.16D)));
            if (unitPrice <= 0D) {
                continue;
            }

            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setProduct(product);
            item.setQuantity(quantity);
            item.setPrice(unitPrice);
            order.getItems().add(item);
        }
    }

    private List<OrderStatusHistory> buildSeedStatusTimeline(
            Order order,
            OrderStatus finalStatus,
            LocalDateTime createdAt,
            String changedBy
    ) {
        if (order == null || finalStatus == null || createdAt == null) {
            return List.of();
        }

        List<OrderStatusHistory> rows = new ArrayList<>();
        rows.add(newSeedHistory(order, OrderStatus.PENDING, OrderStatus.PENDING, "Don hang duoc tao", changedBy, createdAt));

        if (finalStatus == OrderStatus.CONFIRMED
                || finalStatus == OrderStatus.SHIPPING
                || finalStatus == OrderStatus.DELIVERED) {
            rows.add(newSeedHistory(
                    order,
                    OrderStatus.PENDING,
                    OrderStatus.CONFIRMED,
                    "Admin cap nhat trang thai don",
                    changedBy,
                    createdAt.plusHours(3)
            ));
        }

        if (finalStatus == OrderStatus.SHIPPING || finalStatus == OrderStatus.DELIVERED) {
            rows.add(newSeedHistory(
                    order,
                    OrderStatus.CONFIRMED,
                    OrderStatus.SHIPPING,
                    "Admin cap nhat trang thai don",
                    changedBy,
                    createdAt.plusHours(18)
            ));
        }

        if (finalStatus == OrderStatus.DELIVERED) {
            rows.add(newSeedHistory(
                    order,
                    OrderStatus.SHIPPING,
                    OrderStatus.DELIVERED,
                    "Admin cap nhat trang thai don",
                    changedBy,
                    createdAt.plusHours(48)
            ));
        }
        return rows;
    }

    private OrderStatusHistory newSeedHistory(
            Order order,
            OrderStatus fromStatus,
            OrderStatus toStatus,
            String note,
            String changedBy,
            LocalDateTime createdAt
    ) {
        OrderStatusHistory row = new OrderStatusHistory();
        row.setOrder(order);
        row.setFromStatus(fromStatus == null ? toStatus : fromStatus);
        row.setToStatus(toStatus);
        row.setNote(note);
        row.setChangedBy(changedBy);
        row.setCreatedAt(createdAt);
        return row;
    }

    private LocalDateTime buildSeedOrderCreatedAt(int sequence, int maxDaysBack, int maxDaysForward, LocalDateTime now) {
        int hour = 8 + Math.floorMod(sequence * 3, 11);
        int minute = Math.floorMod(sequence * 13, 60);
        LocalDateTime baseline = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0);

        int safeBack = Math.max(1, maxDaysBack);
        int safeForward = Math.max(0, maxDaysForward);
        int span = safeBack + safeForward;
        if (span <= 0) {
            span = safeBack;
        }

        // Deterministic wave mapping: distribute seeded orders in a sinusoidal timeline for a nicer revenue chart.
        double wave = seedWaveNormalized(sequence);
        int rawOffset = (int) Math.round((wave * span) - safeBack);
        int jitter = Math.floorMod((sequence * 29) + (sequence * sequence), 5) - 2;
        int clampedOffset = clampInt(rawOffset + jitter, -safeBack, safeForward);
        if (clampedOffset == 0) {
            clampedOffset = Math.floorMod(sequence, 2) == 0 ? 1 : -1;
        }

        return baseline.plusDays(clampInt(clampedOffset, -safeBack, safeForward));
    }

    private OrderStatus pickSeedOrderStatus(int sequence, LocalDateTime createdAt, LocalDateTime now) {
        boolean isFutureOrder = createdAt != null && now != null && createdAt.isAfter(now);
        int index = Math.floorMod(sequence - 1, 10);

        if (isFutureOrder) {
            return switch (index) {
                case 6 -> OrderStatus.SHIPPING;
                case 7 -> OrderStatus.CONFIRMED;
                case 8 -> OrderStatus.PENDING;
                default -> OrderStatus.DELIVERED;
            };
        }

        return switch (index) {
            case 7 -> OrderStatus.SHIPPING;
            case 8 -> OrderStatus.CONFIRMED;
            case 9 -> OrderStatus.PENDING;
            default -> OrderStatus.DELIVERED;
        };
    }

    private double seedWaveNormalized(int sequence) {
        int cycle = 42;
        double phase = (Math.floorMod(sequence - 1, cycle) / (double) cycle) * Math.PI * 2D;
        double primary = (Math.sin(phase) + 1D) * 0.5D;
        double harmonic = (Math.sin((phase * 2D) + 0.85D) + 1D) * 0.5D;
        double value = (primary * 0.7D) + (harmonic * 0.3D);
        return Math.max(0D, Math.min(1D, value));
    }

    private int clampInt(int value, int min, int max) {
        if (value < min) {
            return min;
        }
        if (value > max) {
            return max;
        }
        return value;
    }

    private PaymentMethod pickSeedPaymentMethod(int sequence) {
        int index = Math.floorMod(sequence - 1, 4);
        return switch (index) {
            case 1 -> PaymentMethod.ONLINE_GATEWAY;
            case 3 -> PaymentMethod.BANK_TRANSFER;
            default -> PaymentMethod.COD;
        };
    }

    private String pickSeedPaymentProvider(int sequence) {
        int index = Math.floorMod(sequence - 1, 3);
        return switch (index) {
            case 1 -> PaymentGatewayProvider.VNPAY.name();
            case 2 -> PaymentGatewayProvider.MOMO.name();
            default -> "MOCK_GATEWAY";
        };
    }

    private OnlinePaymentStatus resolveSeedOnlinePaymentStatus(OrderStatus status) {
        if (status == OrderStatus.DELIVERED) {
            return OnlinePaymentStatus.PAID;
        }
        return OnlinePaymentStatus.PENDING;
    }

    private int pickSeedDiscountPercent(int sequence) {
        if (Math.floorMod(sequence, 9) == 0) {
            return 10;
        }
        if (Math.floorMod(sequence, 7) == 0) {
            return 5;
        }
        return 0;
    }

    private String buildSeedShippingAddress(User user, int sequence) {
        String base = user == null ? null : user.getAddress();
        if (!isBlank(base)) {
            return base.trim();
        }
        return pick(sequence,
                "126 Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh",
                "56 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội",
                "89 Lê Lợi, Hải Châu, Đà Nẵng",
                "205 Nguyễn Văn Linh, Ninh Kiều, Cần Thơ"
        );
    }

    private boolean isOnlinePaymentMethod(PaymentMethod paymentMethod) {
        return paymentMethod == PaymentMethod.ONLINE_GATEWAY || paymentMethod == PaymentMethod.BANK_TRANSFER;
    }

    private PaymentMethod normalizePaymentMethodForDatabase(PaymentMethod requestedMethod) {
        PaymentMethod method = requestedMethod == null ? PaymentMethod.COD : requestedMethod;
        if (method != PaymentMethod.ONLINE_GATEWAY) {
            return method;
        }
        // Keep seed data compatible with legacy enum('BANK_TRANSFER','COD') schemas.
        return isLegacyBankTransferEnumColumn() ? PaymentMethod.BANK_TRANSFER : PaymentMethod.ONLINE_GATEWAY;
    }

    private boolean isLegacyBankTransferEnumColumn() {
        if (legacyBankTransferEnumColumn != null) {
            return legacyBankTransferEnumColumn;
        }

        synchronized (this) {
            if (legacyBankTransferEnumColumn != null) {
                return legacyBankTransferEnumColumn;
            }

            boolean legacy = false;
            try {
                Map<String, Object> row = jdbcTemplate.queryForMap("""
                        SELECT DATA_TYPE, COLUMN_TYPE
                        FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND TABLE_NAME = 'orders'
                          AND COLUMN_NAME = 'payment_method'
                        """);
                String dataType = String.valueOf(row.getOrDefault("DATA_TYPE", "")).toLowerCase(Locale.ROOT);
                String columnType = String.valueOf(row.getOrDefault("COLUMN_TYPE", "")).toUpperCase(Locale.ROOT);
                legacy = "enum".equals(dataType)
                        && columnType.contains("BANK_TRANSFER")
                        && !columnType.contains("ONLINE_GATEWAY");
            } catch (RuntimeException ignored) {
                // If metadata can't be read, keep current behavior and do not block startup.
            }

            legacyBankTransferEnumColumn = legacy;
            return legacy;
        }
    }

    private String normalizeRequired(String raw, String field) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) {
            throw new IllegalArgumentException("Missing required config: " + field);
        }
        return value;
    }

    private boolean isBlank(String raw) {
        return raw == null || raw.trim().isBlank();
    }

    private boolean equalsIgnoreCase(String left, String right) {
        if (left == null && right == null) {
            return true;
        }
        if (left == null || right == null) {
            return false;
        }
        return left.trim().equalsIgnoreCase(right.trim());
    }

    private void backfillLegacyCartVariantKeys() {
        try {
            Integer columnCount = jdbcTemplate.queryForObject(
                    """
                            SELECT COUNT(*)
                            FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = DATABASE()
                              AND TABLE_NAME = 'cart_items'
                              AND COLUMN_NAME = 'product_variant_id'
                            """,
                    Integer.class
            );
            if (columnCount == null || columnCount <= 0) {
                return;
            }

            int updated = jdbcTemplate.update(
                    "UPDATE cart_items SET product_variant_id = 0 WHERE product_variant_id IS NULL"
            );
            if (updated > 0) {
                log.info("Backfilled {} cart_items rows with null variant key -> 0", updated);
            }
        } catch (RuntimeException ex) {
            // This migration is best-effort and should not block startup.
            log.warn("Skip cart_items variant-key backfill: {}", ex.getMessage());
        }
    }

    private void backfillLegacyOrderItemVariantKeys() {
        try {
            Integer columnCount = jdbcTemplate.queryForObject(
                    """
                            SELECT COUNT(*)
                            FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = DATABASE()
                              AND TABLE_NAME = 'order_items'
                              AND COLUMN_NAME = 'product_variant_id'
                            """,
                    Integer.class
            );
            if (columnCount == null || columnCount <= 0) {
                return;
            }

            int updated = jdbcTemplate.update(
                    "UPDATE order_items SET product_variant_id = 0 WHERE product_variant_id IS NULL"
            );
            if (updated > 0) {
                log.info("Backfilled {} order_items rows with null variant key -> 0", updated);
            }
        } catch (RuntimeException ex) {
            // This migration is best-effort and should not block startup.
            log.warn("Skip order_items variant-key backfill: {}", ex.getMessage());
        }
    }

    private void migrateCartItemVariantUniqueConstraint() {
        try {
            Integer columnCount = jdbcTemplate.queryForObject(
                    """
                            SELECT COUNT(*)
                            FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = DATABASE()
                              AND TABLE_NAME = 'cart_items'
                              AND COLUMN_NAME = 'product_variant_id'
                            """,
                    Integer.class
            );
            if (columnCount == null || columnCount <= 0) {
                return;
            }

            List<String> legacyUniqueIndexes = jdbcTemplate.queryForList(
                    """
                            SELECT INDEX_NAME
                            FROM (
                                SELECT INDEX_NAME,
                                       SUM(CASE WHEN COLUMN_NAME = 'user_id' THEN 1 ELSE 0 END) AS has_user,
                                       SUM(CASE WHEN COLUMN_NAME = 'product_id' THEN 1 ELSE 0 END) AS has_product,
                                       SUM(CASE WHEN COLUMN_NAME = 'product_variant_id' THEN 1 ELSE 0 END) AS has_variant
                                FROM INFORMATION_SCHEMA.STATISTICS
                                WHERE TABLE_SCHEMA = DATABASE()
                                  AND TABLE_NAME = 'cart_items'
                                  AND NON_UNIQUE = 0
                                  AND INDEX_NAME <> 'PRIMARY'
                                GROUP BY INDEX_NAME
                            ) x
                            WHERE has_user > 0
                              AND has_product > 0
                              AND has_variant = 0
                            """,
                    String.class
            );
            for (String indexName : legacyUniqueIndexes) {
                if (!isSafeSqlIdentifier(indexName)) {
                    continue;
                }
                jdbcTemplate.execute("ALTER TABLE cart_items DROP INDEX `" + indexName + "`");
                log.info("Dropped legacy unique index {} on cart_items", indexName);
            }

            jdbcTemplate.execute("ALTER TABLE cart_items MODIFY COLUMN product_variant_id BIGINT NOT NULL DEFAULT 0");

            Integer desiredIndexCount = jdbcTemplate.queryForObject(
                    """
                            SELECT COUNT(*)
                            FROM INFORMATION_SCHEMA.STATISTICS
                            WHERE TABLE_SCHEMA = DATABASE()
                              AND TABLE_NAME = 'cart_items'
                              AND INDEX_NAME = 'uk_cart_user_product_variant'
                            """,
                    Integer.class
            );
            if (desiredIndexCount == null || desiredIndexCount <= 0) {
                jdbcTemplate.execute("""
                        ALTER TABLE cart_items
                        ADD UNIQUE INDEX uk_cart_user_product_variant (user_id, product_id, product_variant_id)
                        """);
                log.info("Created unique index uk_cart_user_product_variant on cart_items");
            }
        } catch (RuntimeException ex) {
            // This migration is best-effort and should not block startup.
            log.warn("Skip cart_items unique-index migration for variant support: {}", ex.getMessage());
        }
    }

    private void backfillLegacyProductVersion() {
        try {
            Integer columnCount = jdbcTemplate.queryForObject(
                    """
                            SELECT COUNT(*)
                            FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = DATABASE()
                              AND TABLE_NAME = 'products'
                              AND COLUMN_NAME = 'version'
                            """,
                    Integer.class
            );
            if (columnCount == null || columnCount <= 0) {
                return;
            }

            // Keep legacy rows compatible with optimistic lock in Product entity.
            int updated = jdbcTemplate.update("UPDATE products SET version = 0 WHERE version IS NULL");
            if (updated > 0) {
                log.info("Backfilled {} product rows with null version -> 0", updated);
            }
        } catch (RuntimeException ex) {
            // This maintenance migration should never block app startup.
            log.warn("Skip legacy product version backfill: {}", ex.getMessage());
        }
    }

    private void widenProductDescriptionColumnIfNeeded() {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    """
                            SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
                            FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = DATABASE()
                              AND TABLE_NAME = 'products'
                              AND COLUMN_NAME = 'description'
                            """
            );
            if (rows.isEmpty()) {
                return;
            }

            Map<String, Object> row = rows.get(0);
            String dataType = String.valueOf(row.getOrDefault("DATA_TYPE", "")).toLowerCase(Locale.ROOT);
            Long maxLength = null;
            Object rawLen = row.get("CHARACTER_MAXIMUM_LENGTH");
            if (rawLen instanceof Number number) {
                maxLength = number.longValue();
            } else if (rawLen != null) {
                try {
                    maxLength = Long.parseLong(String.valueOf(rawLen));
                } catch (NumberFormatException ignored) {
                    maxLength = null;
                }
            }

            boolean alreadyTextType = dataType.contains("text");
            boolean needWiden = !alreadyTextType && maxLength != null && maxLength < 8000;
            if (!needWiden) {
                return;
            }

            jdbcTemplate.execute("ALTER TABLE products MODIFY COLUMN description TEXT NULL");
            log.info("Widened products.description to TEXT to support long product descriptions");
        } catch (RuntimeException ex) {
            // Keep startup resilient: description migration is best-effort.
            log.warn("Skip products.description widening: {}", ex.getMessage());
        }
    }

    private void ensureProductIdsStartFromOne() {
        try {
            Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM products", Integer.class);
            if (count == null || count != 0) {
                Long minId = jdbcTemplate.queryForObject("SELECT MIN(id) FROM products", Long.class);
                if (minId == null || minId == 1L) {
                    syncProductAutoIncrement();
                    return;
                }

                long shift = 1L - minId;
                jdbcTemplate.execute("DROP TEMPORARY TABLE IF EXISTS tmp_product_id_shift_map");
                jdbcTemplate.execute("""
                        CREATE TEMPORARY TABLE tmp_product_id_shift_map (
                            old_id BIGINT PRIMARY KEY,
                            new_id BIGINT NOT NULL UNIQUE
                        )
                        """);
                jdbcTemplate.update(
                        "INSERT INTO tmp_product_id_shift_map(old_id, new_id) SELECT id, id + ? FROM products",
                        shift
                );

                Long maxId = jdbcTemplate.queryForObject("SELECT COALESCE(MAX(id), 0) FROM products", Long.class);
                long tempOffset = Math.max(100000L, (maxId == null ? 0L : maxId) + Math.abs(shift) + 1000L);

                jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");

                List<String> refTables = jdbcTemplate.queryForList(
                        """
                                SELECT DISTINCT TABLE_NAME
                                FROM INFORMATION_SCHEMA.COLUMNS
                                WHERE TABLE_SCHEMA = DATABASE()
                                  AND COLUMN_NAME = 'product_id'
                                  AND TABLE_NAME <> 'products'
                                """,
                        String.class
                );

                for (String table : refTables) {
                    if (!isSafeSqlIdentifier(table)) {
                        continue;
                    }
                    jdbcTemplate.execute(
                            "UPDATE `" + table + "` t " +
                                    "JOIN tmp_product_id_shift_map m ON t.product_id = m.old_id " +
                                    "SET t.product_id = m.new_id"
                    );
                }

                // Two-step update avoids potential PK collision while rewriting ids.
                jdbcTemplate.execute(
                        "UPDATE products p " +
                                "JOIN tmp_product_id_shift_map m ON p.id = m.old_id " +
                                "SET p.id = m.new_id + " + tempOffset
                );
                jdbcTemplate.execute(
                        "UPDATE products SET id = id - " + tempOffset + " WHERE id > " + tempOffset
                );

                jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
                syncProductAutoIncrement();
                log.info("Shifted product ids by {} so smallest id starts from 1", shift);
                return;
            }

            // Ensure first inserted product gets id >= 1 when table is empty.
            jdbcTemplate.execute("ALTER TABLE products AUTO_INCREMENT = 1");
        } catch (RuntimeException ex) {
            try {
                jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
            } catch (RuntimeException ignored) {
                // Ignore best-effort cleanup.
            }
            // Non-critical maintenance; never block startup.
            log.warn("Skip product auto-increment reset: {}", ex.getMessage());
        }
    }

    private void syncProductAutoIncrement() {
        Long nextId = jdbcTemplate.queryForObject("SELECT COALESCE(MAX(id), 0) + 1 FROM products", Long.class);
        long safeNextId = Math.max(1L, nextId == null ? 1L : nextId);
        jdbcTemplate.execute("ALTER TABLE products AUTO_INCREMENT = " + safeNextId);
    }

    private boolean isSafeSqlIdentifier(String value) {
        return value != null && value.matches("[A-Za-z0-9_]+");
    }

    private record SeedOrderDraft(Order order, OrderStatus status, LocalDateTime createdAt) {}

    private record SeedCategoryProfile(String name, String description) {}

    private record SeedCustomerProfile(String username, String email, String phone, String address) {}
}
