$ErrorActionPreference = 'Stop'

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Url,
        $BodyObject = $null,
        [string]$Token = $null
    )

    $headers = @{}
    if ($Token) {
        $headers['Authorization'] = "Bearer $Token"
    }

    $jsonBody = $null
    if ($null -ne $BodyObject) {
        $jsonBody = $BodyObject | ConvertTo-Json -Depth 10
    }

    try {
        if ($null -ne $jsonBody) {
            $resp = Invoke-WebRequest -Uri $Url -Method $Method -Headers $headers -Body $jsonBody -ContentType 'application/json' -TimeoutSec 20 -UseBasicParsing
        } else {
            $resp = Invoke-WebRequest -Uri $Url -Method $Method -Headers $headers -TimeoutSec 20 -UseBasicParsing
        }

        $raw = $resp.Content
        $body = $null
        if ($raw) {
            try {
                $body = $raw | ConvertFrom-Json
            } catch {
                $body = $raw
            }
        }

        return [pscustomobject]@{
            Status = [int]$resp.StatusCode
            Raw = $raw
            Body = $body
        }
    } catch {
        $ex = $_.Exception
        if ($null -eq $ex.Response) {
            return [pscustomobject]@{
                Status = 0
                Raw = $ex.Message
                Body = $null
            }
        }

        $statusCode = [int]$ex.Response.StatusCode
        $stream = $ex.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $raw = $reader.ReadToEnd()
        $reader.Dispose()
        $stream.Dispose()

        $body = $null
        if ($raw) {
            try {
                $body = $raw | ConvertFrom-Json
            } catch {
                $body = $raw
            }
        }

        return [pscustomobject]@{
            Status = $statusCode
            Raw = $raw
            Body = $body
        }
    }
}

function PropVal {
    param($Obj, [string]$Name)
    if ($null -eq $Obj -or $Obj -is [string]) {
        return $null
    }
    $p = $Obj.PSObject.Properties[$Name]
    if ($p) {
        return $p.Value
    }
    return $null
}

function Txt {
    param($Value)
    if ($null -eq $Value) {
        return ''
    }
    $s = [string]$Value
    if ($s.Length -gt 180) {
        return $s.Substring(0, 180) + '...'
    }
    return $s
}

$results = New-Object System.Collections.Generic.List[object]
function Add-Result {
    param(
        [string]$Id,
        [string]$Desc,
        [string]$Steps,
        [string]$DataIn,
        [string]$Expected,
        [string]$Actual,
        [bool]$Passed
    )

    $results.Add([pscustomobject]@{
            TestCaseID = $Id
            MoTa = $Desc
            BuocThucHien = $Steps
            DuLieuDauVao = $DataIn
            KetQuaMongDoi = $Expected
            KetQuaThucTe = $Actual
            TrangThai = $(if ($Passed) { 'PASS' } else { 'FAIL' })
        }) | Out-Null
}

function Login-Token {
    param(
        [string]$Base,
        [string]$Username,
        [string]$Password
    )

    $resp = Invoke-Api -Method 'POST' -Url "$Base/api/auth/login" -BodyObject @{
        username = $Username
        password = $Password
    }
    if ($resp.Status -eq 200) {
        return PropVal $resp.Body 'token'
    }
    return $null
}

function Test-PortInUse {
    param([int]$Port)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        $connected = $iar.AsyncWaitHandle.WaitOne(250)
        if ($connected -and $client.Connected) {
            $client.EndConnect($iar)
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

$port = $null
foreach ($candidate in 8093..8110) {
    if (-not (Test-PortInUse -Port $candidate)) {
        $port = $candidate
        break
    }
}
if ($null -eq $port) {
    throw 'No free port available in range 8093-8110'
}

$base = "http://127.0.0.1:$port"
$env:SERVER_PORT = "$port"
$env:FORGOT_PASSWORD_EXPOSE_TOKEN = 'true'
$appProc = $null

try {
    $appProc = Start-Process -FilePath '.\mvnw.cmd' -ArgumentList 'spring-boot:run' -WorkingDirectory (Get-Location).Path -PassThru -WindowStyle Hidden -RedirectStandardOutput 'tc_new_server.out.log' -RedirectStandardError 'tc_new_server.err.log'
    Write-Output "START_APP pid=$($appProc.Id) port=$port"

    $ready = $false
    for ($i = 0; $i -lt 120; $i++) {
        if (($i % 5) -eq 0) {
            Write-Output "WAIT_APP sec=$i port=$port"
        }
        Start-Sleep -Seconds 1
        try {
            $probe = Invoke-WebRequest -Uri "$base/api/public/categories" -TimeoutSec 10 -UseBasicParsing
            if ([int]$probe.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {
        }
    }
    if (-not $ready) {
        throw 'App not ready'
    }
    Write-Output "APP_READY port=$port"

    $adminToken = Login-Token -Base $base -Username 'admin' -Password 'Admin@123'
    $superToken = Login-Token -Base $base -Username 'superadmin' -Password 'SuperAdmin@123'
    if (-not $adminToken) {
        throw 'Admin login failed'
    }
    if (-not $superToken) {
        throw 'Super Admin login failed'
    }

    $stamp = Get-Date -Format 'yyyyMMddHHmmss'
    $customerUsername = "tcnew$stamp"
    $customerPassword = 'Test@1234'
    $registerResp = Invoke-Api -Method 'POST' -Url "$base/api/auth/register" -BodyObject @{
        username = $customerUsername
        fullName = 'Test Customer New'
        email = "$customerUsername@example.com"
        password = $customerPassword
        confirmPassword = $customerPassword
        phone = '0901234567'
        address = '123 Test Street'
    }
    if ($registerResp.Status -notin @(200, 201)) {
        throw "Register failed. HTTP $($registerResp.Status)"
    }

    $customerToken = Login-Token -Base $base -Username $customerUsername -Password $customerPassword
    if (-not $customerToken) {
        throw 'Customer login failed'
    }

    $productsResp = Invoke-Api -Method 'GET' -Url "$base/api/public/products/paged?page=0&size=20"
    if ($productsResp.Status -ne 200) {
        throw 'Cannot load products'
    }
    $products = @($productsResp.Body.items)
    if ($products.Count -eq 0) {
        throw 'No products found'
    }

    $productId = [long]$products[0].id
    $productWithCategory = $null
    foreach ($item in $products) {
        if ($item.category -and $item.category.id) {
            $productWithCategory = $item
            break
        }
    }
    if ($null -eq $productWithCategory) {
        throw 'No category found in products'
    }
    $usedCategoryId = [long]$productWithCategory.category.id

    # Group: Forgot/Reset password
    $forgotExisting = Invoke-Api -Method 'POST' -Url "$base/api/auth/forgot-password" -BodyObject @{ identifier = $customerUsername }
    $resetToken = PropVal $forgotExisting.Body 'resetToken'
    Add-Result 'TC-16' 'Quen mat khau tai khoan ton tai' 'POST /api/auth/forgot-password' "identifier=$customerUsername" 'HTTP 200 + co token dev' "HTTP $($forgotExisting.Status); tokenExists=$(-not [string]::IsNullOrWhiteSpace([string]$resetToken))" ($forgotExisting.Status -eq 200 -and -not [string]::IsNullOrWhiteSpace([string]$resetToken))

    $forgotUnknown = Invoke-Api -Method 'POST' -Url "$base/api/auth/forgot-password" -BodyObject @{ identifier = "unknown_$stamp" }
    $unknownToken = PropVal $forgotUnknown.Body 'resetToken'
    Add-Result 'TC-17' 'Quen mat khau tai khoan khong ton tai' 'POST /api/auth/forgot-password' "identifier=unknown_$stamp" 'HTTP 200 + khong lo token' "HTTP $($forgotUnknown.Status); tokenNull=$([string]::IsNullOrWhiteSpace([string]$unknownToken))" ($forgotUnknown.Status -eq 200 -and [string]::IsNullOrWhiteSpace([string]$unknownToken))

    $newPassword = 'NewPass@1234'
    $resetValid = Invoke-Api -Method 'POST' -Url "$base/api/auth/reset-password" -BodyObject @{ token = $resetToken; newPassword = $newPassword }
    $reloginToken = Login-Token -Base $base -Username $customerUsername -Password $newPassword
    Add-Result 'TC-18' 'Reset mat khau token hop le' 'POST /api/auth/reset-password + login lai' 'token hop le' 'HTTP 200 + login bang mat khau moi duoc' "resetHTTP=$($resetValid.Status); reloginOk=$(-not [string]::IsNullOrWhiteSpace([string]$reloginToken))" ($resetValid.Status -eq 200 -and -not [string]::IsNullOrWhiteSpace([string]$reloginToken))
    if (-not [string]::IsNullOrWhiteSpace([string]$reloginToken)) {
        $customerPassword = $newPassword
        $customerToken = $reloginToken
    }

    $resetInvalid = Invoke-Api -Method 'POST' -Url "$base/api/auth/reset-password" -BodyObject @{ token = 'invalid-token-123'; newPassword = 'Another@1234' }
    Add-Result 'TC-19' 'Reset mat khau token sai' 'POST /api/auth/reset-password' 'token invalid-token-123' 'HTTP 400' "HTTP $($resetInvalid.Status); message=$(Txt (PropVal $resetInvalid.Body 'message'))" ($resetInvalid.Status -eq 400)
    Write-Output "DONE_GROUP forgot_reset"

    # Group: Category management
    $categoryName = "TC Cat $stamp"
    $createCategory = Invoke-Api -Method 'POST' -Url "$base/api/admin/categories" -Token $adminToken -BodyObject @{ name = $categoryName; description = 'Danh muc test' }
    $categoryId = PropVal $createCategory.Body 'id'
    Add-Result 'TC-20' 'Admin them danh muc moi' 'POST /api/admin/categories' "name=$categoryName" 'HTTP 201 + co id' "HTTP $($createCategory.Status); id=$categoryId" ($createCategory.Status -eq 201 -and $categoryId)

    $createDuplicate = Invoke-Api -Method 'POST' -Url "$base/api/admin/categories" -Token $adminToken -BodyObject @{ name = $categoryName; description = 'duplicate' }
    Add-Result 'TC-21' 'Admin them danh muc trung ten' 'POST /api/admin/categories' "name=$categoryName (duplicate)" 'HTTP 400' "HTTP $($createDuplicate.Status); message=$(Txt (PropVal $createDuplicate.Body 'message'))" ($createDuplicate.Status -eq 400)

    $updatedCategoryName = "$categoryName Updated"
    $updateCategory = Invoke-Api -Method 'PUT' -Url "$base/api/admin/categories/$categoryId" -Token $adminToken -BodyObject @{ name = $updatedCategoryName; description = 'updated' }
    Add-Result 'TC-22' 'Admin cap nhat danh muc' 'PUT /api/admin/categories/{id}' "id=$categoryId" 'HTTP 200 + ten moi' "HTTP $($updateCategory.Status); returnedName=$(PropVal $updateCategory.Body 'name')" ($updateCategory.Status -eq 200 -and (PropVal $updateCategory.Body 'name') -eq $updatedCategoryName)

    $deleteCategory = Invoke-Api -Method 'DELETE' -Url "$base/api/admin/categories/$categoryId" -Token $adminToken
    Add-Result 'TC-23' 'Admin xoa danh muc rong' 'DELETE /api/admin/categories/{id}' "id=$categoryId" 'HTTP 204' "HTTP $($deleteCategory.Status)" ($deleteCategory.Status -eq 204)

    $deleteUsedCategory = Invoke-Api -Method 'DELETE' -Url "$base/api/admin/categories/$usedCategoryId" -Token $adminToken
    Add-Result 'TC-24' 'Admin xoa danh muc dang duoc su dung' 'DELETE /api/admin/categories/{id}' "id=$usedCategoryId" 'HTTP 400' "HTTP $($deleteUsedCategory.Status); message=$(Txt (PropVal $deleteUsedCategory.Body 'message'))" ($deleteUsedCategory.Status -eq 400)
    Write-Output "DONE_GROUP category"

    # Group: Account management
    $listUsers = Invoke-Api -Method 'GET' -Url "$base/api/admin/users" -Token $adminToken
    $userCount = if ($listUsers.Body -is [System.Array]) { $listUsers.Body.Count } elseif ($listUsers.Body) { 1 } else { 0 }
    Add-Result 'TC-25' 'Admin xem danh sach tai khoan' 'GET /api/admin/users' '-' 'HTTP 200 + co du lieu' "HTTP $($listUsers.Status); count=$userCount" ($listUsers.Status -eq 200 -and $userCount -gt 0)

    $managedUserA = "tc_manage_a_$stamp"
    $managedEmailA = "$managedUserA@example.com"
    $createUserA = Invoke-Api -Method 'POST' -Url "$base/api/admin/users" -Token $adminToken -BodyObject @{
        fullName = 'Managed User A'
        username = $managedUserA
        email = $managedEmailA
        password = 'Manage@123'
        phone = '0911111111'
        address = 'HCM'
        role = 'CUSTOMER'
    }
    $managedUserAId = PropVal $createUserA.Body 'id'
    Add-Result 'TC-26' 'Admin tao tai khoan customer' 'POST /api/admin/users' "username=$managedUserA" 'HTTP 201 + id' "HTTP $($createUserA.Status); id=$managedUserAId" ($createUserA.Status -eq 201 -and $managedUserAId)

    $updateUserA = Invoke-Api -Method 'PUT' -Url "$base/api/admin/users/$managedUserAId" -Token $adminToken -BodyObject @{
        fullName = 'Managed User A Updated'
        username = $managedUserA
        email = $managedEmailA
        phone = '0922222222'
        address = 'Ha Noi'
    }
    Add-Result 'TC-27' 'Admin cap nhat thong tin tai khoan' 'PUT /api/admin/users/{id}' "id=$managedUserAId" 'HTTP 200 + du lieu moi' "HTTP $($updateUserA.Status); phone=$(PropVal $updateUserA.Body 'phone')" ($updateUserA.Status -eq 200 -and (PropVal $updateUserA.Body 'phone') -eq '0922222222')

    $deactivateUserA = Invoke-Api -Method 'PUT' -Url "$base/api/admin/users/$managedUserAId/active" -Token $adminToken -BodyObject @{ active = $false }
    Add-Result 'TC-28' 'Admin khoa tai khoan customer' 'PUT /api/admin/users/{id}/active' "id=$managedUserAId; active=false" 'HTTP 200 + active=false' "HTTP $($deactivateUserA.Status); active=$(PropVal $deactivateUserA.Body 'active')" ($deactivateUserA.Status -eq 200 -and (PropVal $deactivateUserA.Body 'active') -eq $false)

    $managedUserB = "tc_manage_b_$stamp"
    $managedEmailB = "$managedUserB@example.com"
    $createUserB = Invoke-Api -Method 'POST' -Url "$base/api/admin/users" -Token $adminToken -BodyObject @{
        fullName = 'Managed User B'
        username = $managedUserB
        email = $managedEmailB
        password = 'Manage@123'
        phone = '0933333333'
        address = 'Da Nang'
        role = 'CUSTOMER'
    }
    $managedUserBId = PropVal $createUserB.Body 'id'

    $updateRoleBySuper = Invoke-Api -Method 'PUT' -Url "$base/api/super-admin/users/$managedUserBId/role" -Token $superToken -BodyObject @{ role = 'ADMIN' }
    Add-Result 'TC-29' 'Super Admin doi role tai khoan' 'PUT /api/super-admin/users/{id}/role' "id=$managedUserBId; role=ADMIN" 'HTTP 200 + role=ADMIN' "HTTP $($updateRoleBySuper.Status); role=$(PropVal $updateRoleBySuper.Body 'role')" ($updateRoleBySuper.Status -eq 200 -and (PropVal $updateRoleBySuper.Body 'role') -eq 'ADMIN')

    $updateRoleByAdmin = Invoke-Api -Method 'PUT' -Url "$base/api/super-admin/users/$managedUserBId/role" -Token $adminToken -BodyObject @{ role = 'CUSTOMER' }
    Add-Result 'TC-30' 'Admin thuong doi role qua endpoint super-admin' 'PUT /api/super-admin/users/{id}/role' "id=$managedUserBId; role=CUSTOMER" 'HTTP 403' "HTTP $($updateRoleByAdmin.Status); message=$(Txt (PropVal $updateRoleByAdmin.Body 'message'))" ($updateRoleByAdmin.Status -eq 403)

    $deleteUserA = Invoke-Api -Method 'DELETE' -Url "$base/api/admin/users/$managedUserAId" -Token $adminToken
    Add-Result 'TC-31' 'Admin xoa customer chua co don' 'DELETE /api/admin/users/{id}' "id=$managedUserAId" 'HTTP 204' "HTTP $($deleteUserA.Status)" ($deleteUserA.Status -eq 204)
    Write-Output "DONE_GROUP account"

    # Group: Support messaging
    $sendMessage = Invoke-Api -Method 'POST' -Url "$base/api/customer/messages" -Token $customerToken -BodyObject @{ content = "Xin ho tro don hang $stamp" }
    $supportCustomerId = PropVal $sendMessage.Body 'customerId'
    Add-Result 'TC-32' 'Customer gui tin nhan ho tro' 'POST /api/customer/messages' 'content hop le' 'HTTP 201 + tao message' "HTTP $($sendMessage.Status); messageId=$(PropVal $sendMessage.Body 'id')" ($sendMessage.Status -eq 201 -and (PropVal $sendMessage.Body 'id'))

    $adminConversations = Invoke-Api -Method 'GET' -Url "$base/api/admin/messages/conversations" -Token $adminToken
    $foundConversation = $false
    if ($adminConversations.Body -is [System.Array]) {
        foreach ($conv in $adminConversations.Body) {
            if ($conv.customerId -eq $supportCustomerId) {
                $foundConversation = $true
                break
            }
        }
    }
    Add-Result 'TC-33' 'Admin xem danh sach hoi thoai' 'GET /api/admin/messages/conversations' "customerId=$supportCustomerId" 'HTTP 200 + co hoi thoai khach' "HTTP $($adminConversations.Status); found=$foundConversation" ($adminConversations.Status -eq 200 -and $foundConversation)

    $adminReply = Invoke-Api -Method 'POST' -Url "$base/api/admin/messages/conversations/$supportCustomerId/reply" -Token $adminToken -BodyObject @{ content = "Admin da nhan $stamp" }
    Add-Result 'TC-34' 'Admin phan hoi ho tro' 'POST /api/admin/messages/conversations/{customerId}/reply' "customerId=$supportCustomerId" 'HTTP 201 + tao reply' "HTTP $($adminReply.Status); replyId=$(PropVal $adminReply.Body 'id')" ($adminReply.Status -eq 201 -and (PropVal $adminReply.Body 'id'))

    $customerConversation = Invoke-Api -Method 'GET' -Url "$base/api/customer/messages" -Token $customerToken
    $messageCount = 0
    $hasAdminReply = $false
    if ($customerConversation.Body) {
        $messages = $customerConversation.Body.messages
        if ($messages -is [System.Array]) {
            $messageCount = $messages.Count
            foreach ($m in $messages) {
                if ($m.senderRole -eq 'ADMIN' -or $m.senderRole -eq 'SUPER_ADMIN') {
                    $hasAdminReply = $true
                    break
                }
            }
        }
    }
    Add-Result 'TC-35' 'Customer xem hoi thoai co reply admin' 'GET /api/customer/messages' '-' 'HTTP 200 + co tin nhan admin' "HTTP $($customerConversation.Status); count=$messageCount; hasAdminReply=$hasAdminReply" ($customerConversation.Status -eq 200 -and $hasAdminReply)

    $blankMessage = Invoke-Api -Method 'POST' -Url "$base/api/customer/messages" -Token $customerToken -BodyObject @{ content = '' }
    Add-Result 'TC-36' 'Customer gui tin nhan rong' 'POST /api/customer/messages' 'content=""' 'HTTP 400' "HTTP $($blankMessage.Status); message=$(Txt (PropVal $blankMessage.Body 'message'))" ($blankMessage.Status -eq 400)
    Write-Output "DONE_GROUP support"

    # Group: Product review
    $reviewBeforePurchase = Invoke-Api -Method 'POST' -Url "$base/api/customer/products/$productId/reviews" -Token $customerToken -BodyObject @{ rating = 5; content = 'Danh gia truoc mua' }
    Add-Result 'TC-37' 'Danh gia khi chua co don DELIVERED' 'POST /api/customer/products/{id}/reviews' "productId=$productId" 'HTTP 400' "HTTP $($reviewBeforePurchase.Status); message=$(Txt (PropVal $reviewBeforePurchase.Body 'message'))" ($reviewBeforePurchase.Status -eq 400)

    $orderForReview = Invoke-Api -Method 'POST' -Url "$base/api/customer/orders" -Token $customerToken -BodyObject @{
        items = @(@{ productId = $productId; quantity = 1 })
        recipientName = 'Test Customer New'
        recipientPhone = '0901234567'
        shippingAddress = '123 Test Street'
        paymentMethod = 'COD'
    }
    $reviewOrderId = PropVal $orderForReview.Body 'id'
    $deliverReviewOrder = Invoke-Api -Method 'PATCH' -Url "$base/api/admin/orders/$reviewOrderId/status" -Token $adminToken -BodyObject @{ status = 'DELIVERED' }
    $reviewAfterDelivered = Invoke-Api -Method 'POST' -Url "$base/api/customer/products/$productId/reviews" -Token $customerToken -BodyObject @{ rating = 5; content = 'San pham on, giao nhanh' }
    $reviewId = PropVal $reviewAfterDelivered.Body 'id'
    Add-Result 'TC-38' 'Danh gia sau khi don da DELIVERED' 'Tao don -> admin DELIVERED -> gui review' "productId=$productId; orderId=$reviewOrderId" 'HTTP 201 review tao thanh cong' "orderHTTP=$($orderForReview.Status); deliverHTTP=$($deliverReviewOrder.Status); reviewHTTP=$($reviewAfterDelivered.Status); reviewId=$reviewId" ($orderForReview.Status -eq 201 -and $deliverReviewOrder.Status -eq 200 -and $reviewAfterDelivered.Status -eq 201 -and $reviewId)

    $deleteReview = Invoke-Api -Method 'DELETE' -Url "$base/api/customer/products/$productId/reviews/me" -Token $customerToken
    Add-Result 'TC-39' 'Xoa danh gia cua chinh minh' 'DELETE /api/customer/products/{id}/reviews/me' "productId=$productId" 'HTTP 200' "HTTP $($deleteReview.Status); message=$(Txt (PropVal $deleteReview.Body 'message'))" ($deleteReview.Status -eq 200)
    Write-Output "DONE_GROUP review"

    # Group: Promotion/coupon
    $promoCode = "TCPROMO$stamp"
    $startDate = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')
    $endDate = (Get-Date).AddDays(10).ToString('yyyy-MM-dd')

    $createPromotion = Invoke-Api -Method 'POST' -Url "$base/api/admin/promotions" -Token $adminToken -BodyObject @{
        code = $promoCode
        discountPercent = 10
        startDate = $startDate
        endDate = $endDate
        active = $true
    }
    $promotionId = PropVal $createPromotion.Body 'id'
    Add-Result 'TC-40' 'Admin tao ma khuyen mai' 'POST /api/admin/promotions' "code=$promoCode" 'HTTP 201 + id' "HTTP $($createPromotion.Status); promoId=$promotionId" ($createPromotion.Status -eq 201 -and $promotionId)

    $validatePromo = Invoke-Api -Method 'GET' -Url "$base/api/public/promotions/validate?code=$promoCode"
    Add-Result 'TC-41' 'Validate ma khuyen mai hop le' 'GET /api/public/promotions/validate' "code=$promoCode" 'HTTP 200 + discount dung' "HTTP $($validatePromo.Status); discountPercent=$(PropVal $validatePromo.Body 'discountPercent')" ($validatePromo.Status -eq 200 -and (PropVal $validatePromo.Body 'discountPercent') -eq 10)

    $validateInvalidPromo = Invoke-Api -Method 'GET' -Url "$base/api/public/promotions/validate?code=INVALID_$stamp"
    Add-Result 'TC-42' 'Validate ma khuyen mai khong ton tai' 'GET /api/public/promotions/validate' "code=INVALID_$stamp" 'HTTP 400' "HTTP $($validateInvalidPromo.Status); message=$(Txt (PropVal $validateInvalidPromo.Body 'message'))" ($validateInvalidPromo.Status -eq 400)

    $orderWithPromo = Invoke-Api -Method 'POST' -Url "$base/api/customer/orders" -Token $customerToken -BodyObject @{
        items = @(@{ productId = $productId; quantity = 1 })
        recipientName = 'Test Customer New'
        recipientPhone = '0901234567'
        shippingAddress = '123 Test Street'
        promotionCode = $promoCode
        paymentMethod = 'COD'
    }
    Add-Result 'TC-43' 'Ap dung ma khuyen mai khi dat hang' 'POST /api/customer/orders + promotionCode' "promotionCode=$promoCode" 'HTTP 201 tao don thanh cong' "HTTP $($orderWithPromo.Status); promotionCode=$(PropVal $orderWithPromo.Body 'promotionCode'); total=$(PropVal $orderWithPromo.Body 'totalPrice')" ($orderWithPromo.Status -eq 201)
    Write-Output "DONE_GROUP promotion"

    $summary = [pscustomobject]@{
        total = $results.Count
        passed = (@($results | Where-Object { $_.TrangThai -eq 'PASS' })).Count
        failed = (@($results | Where-Object { $_.TrangThai -eq 'FAIL' })).Count
    }

    [pscustomobject]@{
        Summary = $summary
        Results = $results
    } | ConvertTo-Json -Depth 8 | Out-File -FilePath 'tc_new_results.json' -Encoding utf8

    Write-Output "SUMMARY total=$($summary.total) passed=$($summary.passed) failed=$($summary.failed)"
} catch {
    Write-Output "SCRIPT_ERROR: $($_.Exception.Message)"
    if (Test-Path 'tc_new_server.out.log') {
        Write-Output '--- SERVER OUT TAIL ---'
        Get-Content 'tc_new_server.out.log' -Tail 40
    }
    if (Test-Path 'tc_new_server.err.log') {
        Write-Output '--- SERVER ERR TAIL ---'
        Get-Content 'tc_new_server.err.log' -Tail 40
    }
} finally {
    if ($appProc -and -not $appProc.HasExited) {
        Stop-Process -Id $appProc.Id -Force
    }
}
