# Bo 18 Use Case - TechStore1

Tai lieu nay tong hop 18 UC theo dung bo bieu do da co trong:
- `docs/uml/sequence/UC01_sequence.puml` -> `UC18_sequence.puml`
- `docs/uml/analysis/UC01_analysis.puml` -> `UC18_analysis.puml`

## 1. Danh sach 18 UC
| Ma UC | Ten Use Case | Tac nhan chinh |
|---|---|---|
| UC01 | Dang ky tai khoan | Khach vang lai |
| UC02 | Dang nhap | Customer/Admin |
| UC03 | Quen va dat lai mat khau | Nguoi dung |
| UC04 | Xem san pham theo danh muc | Khach hang |
| UC05 | Tim kiem san pham | Khach hang |
| UC06 | Xem chi tiet san pham | Khach hang |
| UC07 | Quan ly gio hang | Khach hang |
| UC08 | Dat hang va thanh toan | Khach hang |
| UC09 | Quan ly thong tin ca nhan | Khach hang |
| UC10 | Danh gia san pham da mua | Khach hang |
| UC11 | Quan ly danh muc san pham | Admin |
| UC12 | Quan ly san pham | Admin |
| UC13 | Quan ly don hang | Admin |
| UC14 | Quan ly tai khoan | Admin/Super Admin |
| UC15 | Quan ly khuyen mai | Admin |
| UC16 | Quan ly banner | Admin |
| UC17 | Khach hang nhan tin ho tro | Khach hang |
| UC18 | Admin phan hoi ho tro | Admin |

## 2. Phan tich cach hoat dong + cach thuc hien tung UC

### UC01 - Dang ky tai khoan
- Cach hoat dong: User nhap thong tin dang ky, he thong kiem tra trung username/email, ma hoa mat khau va tao tai khoan CUSTOMER.
- Cach thuc hien: `RegisterPage -> AuthController -> AuthService -> UserRepository` (kem `PasswordEncoder`), luu vao entity `User`.
- Bieu do: [Sequence](uml/sequence/UC01_sequence.puml), [Analysis](uml/analysis/UC01_analysis.puml)

### UC02 - Dang nhap
- Cach hoat dong: User dang nhap bang username/email + password, he thong xac thuc, phat JWT/cookie neu dung, tang so lan that bai neu sai.
- Cach thuc hien: `LoginPage -> AuthController -> AuthService -> AuthenticationManager/JwtService -> UserRepository`.
- Bieu do: [Sequence](uml/sequence/UC02_sequence.puml), [Analysis](uml/analysis/UC02_analysis.puml)

### UC03 - Quen va dat lai mat khau
- Cach hoat dong: User gui yeu cau reset, he thong tao token va gui email; sau do user nhap token + mat khau moi de cap nhat.
- Cach thuc hien: `ForgotResetPage -> AuthController -> PasswordResetService -> TokenRepo/UserRepo`, ket hop `EmailNotificationService` va `PasswordEncoder`.
- Bieu do: [Sequence](uml/sequence/UC03_sequence.puml), [Analysis](uml/analysis/UC03_analysis.puml)

### UC04 - Xem san pham theo danh muc
- Cach hoat dong: Khach tai danh muc cong khai, chon 1 danh muc de xem danh sach san pham thuoc danh muc do.
- Cach thuc hien: `CategoryProductPage -> CategoryController/CategoryService` (lay categories) va `-> ProductController/ProductService` (lay products theo category).
- Bieu do: [Sequence](uml/sequence/UC04_sequence.puml), [Analysis](uml/analysis/UC04_analysis.puml)

### UC05 - Tim kiem san pham
- Cach hoat dong: Khach nhap tu khoa, he thong tra ket qua tim kiem/loc va hien thi danh sach phu hop.
- Cach thuc hien: `SearchBar -> ProductController -> ProductService -> ProductRepository`, thao tac tren entity `Product`.
- Bieu do: [Sequence](uml/sequence/UC05_sequence.puml), [Analysis](uml/analysis/UC05_analysis.puml)
- Ghi chu theo mau ban gui: `SearchBar` tuong duong `TimKiemSanPhamUI`, `ProductController/ProductService` tuong duong `TimKiemSanPhamController`, `Product` tuong duong `Products`.

### UC06 - Xem chi tiet san pham
- Cach hoat dong: Khach mo trang chi tiet san pham, he thong tai thong tin co ban + bien the + review + tong quan danh gia.
- Cach thuc hien: `ProductDetailPage -> ProductController`, controller dieu phoi `ProductService`, `ProductVariantService`, `ProductReviewService`.
- Bieu do: [Sequence](uml/sequence/UC06_sequence.puml), [Analysis](uml/analysis/UC06_analysis.puml)

### UC07 - Quan ly gio hang
- Cach hoat dong: Khach them san pham vao gio, tang/giam so luong, xoa tung dong hoac xoa toan bo gio.
- Cach thuc hien: `CartPage -> CustomerCartController -> CartService`, su dung `UserRepository`, `ProductRepository`, `ProductVariantRepository`, `CartItemRepository`.
- Bieu do: [Sequence](uml/sequence/UC07_sequence.puml), [Analysis](uml/analysis/UC07_analysis.puml)

### UC08 - Dat hang va thanh toan
- Cach hoat dong: Khach xac nhan thong tin giao hang, tao don; neu chon online thi tao payment session va cap nhat ket qua callback.
- Cach thuc hien: `CheckoutPage -> CustomerOrderController/OrderService` (tao don) va `CheckoutPage -> CustomerPaymentController/PaymentService` (online payment), ket hop `PromotionService`, `OrderStatusHistoryService`.
- Bieu do: [Sequence](uml/sequence/UC08_sequence.puml), [Analysis](uml/analysis/UC08_analysis.puml)

### UC09 - Quan ly thong tin ca nhan
- Cach hoat dong: Khach xem profile, cap nhat thong tin lien he, tuy chon doi mat khau.
- Cach thuc hien: `ProfilePage -> CustomerProfileController -> ProfileService -> UserRepository`, doi mat khau qua `PasswordEncoder`.
- Bieu do: [Sequence](uml/sequence/UC09_sequence.puml), [Analysis](uml/analysis/UC09_analysis.puml)

### UC10 - Danh gia san pham da mua
- Cach hoat dong: Khach danh gia san pham da giao hang (rating + noi dung), he thong tao/sua review.
- Cach thuc hien: `ReviewDialog -> CustomerProductReviewController -> ProductReviewService`, kiem tra dieu kien mua qua `OrderItemRepository`, luu qua `ProductReviewRepository`.
- Bieu do: [Sequence](uml/sequence/UC10_sequence.puml), [Analysis](uml/analysis/UC10_analysis.puml)

### UC11 - Quan ly danh muc san pham (Admin)
- Cach hoat dong: Admin xem/them/sua/xoa danh muc, he thong chan truong hop category dang duoc san pham su dung.
- Cach thuc hien: `AdminCategoryPage -> CategoryController -> CategoryService`, ghi nhat ky qua `AdminAuditLogService`.
- Bieu do: [Sequence](uml/sequence/UC11_sequence.puml), [Analysis](uml/analysis/UC11_analysis.puml)

### UC12 - Quan ly san pham (Admin)
- Cach hoat dong: Admin quan ly san pham (CRUD), quan ly bien the va xoa san pham theo quy tac rang buoc don hang.
- Cach thuc hien: `AdminProductPage -> AdminProductController`, xu ly boi `ProductService` + `ProductVariantService`, ghi audit log.
- Bieu do: [Sequence](uml/sequence/UC12_sequence.puml), [Analysis](uml/analysis/UC12_analysis.puml)

### UC13 - Quan ly don hang (Admin)
- Cach hoat dong: Admin xem danh sach/chi tiet don, cap nhat trang thai, xoa don theo quy tac.
- Cach thuc hien: `AdminOrderPage -> AdminOrderController -> OrderService`, ket hop `OrderStatusHistoryService`, `EmailNotificationService`, `AdminAuditLogService`.
- Bieu do: [Sequence](uml/sequence/UC13_sequence.puml), [Analysis](uml/analysis/UC13_analysis.puml)

### UC14 - Quan ly tai khoan (Admin/Super Admin)
- Cach hoat dong: Admin tao/sua/xoa customer; Super Admin doi role user.
- Cach thuc hien: `AdminUserPage -> UserManagementController -> UserManagementService`, rang buoc quyen role va ghi audit log.
- Bieu do: [Sequence](uml/sequence/UC14_sequence.puml), [Analysis](uml/analysis/UC14_analysis.puml)

### UC15 - Quan ly khuyen mai (Admin)
- Cach hoat dong: Admin CRUD promotion, kiem tra trung ma, pham vi ngay, phan tram giam hop le.
- Cach thuc hien: `AdminPromotionPage -> PromotionController -> PromotionService -> PromotionRepository`, ghi audit log.
- Bieu do: [Sequence](uml/sequence/UC15_sequence.puml), [Analysis](uml/analysis/UC15_analysis.puml)

### UC16 - Quan ly banner (Admin)
- Cach hoat dong: Admin xem danh sach banner trang chu, them banner moi hoac xoa banner.
- Cach thuc hien: `AdminBannerPage -> HomeBannerController -> HomeBannerService -> HomeBannerRepository`, ghi audit log.
- Bieu do: [Sequence](uml/sequence/UC16_sequence.puml), [Analysis](uml/analysis/UC16_analysis.puml)

### UC17 - Khach hang nhan tin ho tro
- Cach hoat dong: Khach xem tong quan inbox ho tro, tai hoi thoai va gui tin nhan moi.
- Cach thuc hien: `SupportChatPage -> CustomerSupportMessageController -> SupportMessageService`, su dung `UserRepository` + `SupportMessageRepository`.
- Bieu do: [Sequence](uml/sequence/UC17_sequence.puml), [Analysis](uml/analysis/UC17_analysis.puml)

### UC18 - Admin phan hoi ho tro
- Cach hoat dong: Admin xem danh sach hoi thoai khach hang, mo tung hoi thoai va gui phan hoi.
- Cach thuc hien: `AdminSupportInboxPage -> AdminSupportMessageController -> SupportMessageService`, xu ly danh dau da doc va luu reply.
- Bieu do: [Sequence](uml/sequence/UC18_sequence.puml), [Analysis](uml/analysis/UC18_analysis.puml)

## 3. Quan he include/extend de ve so do UC
- UC03 `Quen va dat lai mat khau` <<extend>> UC02 `Dang nhap`.
- UC06 `Xem chi tiet san pham` <<extend>> UC04 `Xem san pham theo danh muc`.
- UC07 `Quan ly gio hang` <<extend>> UC06 `Xem chi tiet san pham`.
- UC08 `Dat hang va thanh toan` <<include>> UC07 `Quan ly gio hang`.
- UC10 `Danh gia san pham da mua` <<extend>> UC08 `Dat hang va thanh toan`.
- UC12 `Quan ly san pham` <<include>> UC11 `Quan ly danh muc san pham`.
- UC18 `Admin phan hoi ho tro` <<extend>> UC17 `Khach hang nhan tin ho tro`.
