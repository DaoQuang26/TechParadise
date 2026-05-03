param(
  [string]$BaseUrl = "http://localhost:8080",
  [string]$Username = "admin",
  [string]$Password = "Admin@123"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:gearCoreSpecCache = @{}

function Write-Step {
  param([string]$Message)
  Write-Host "[IMPORT] $Message"
}

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null,
    [hashtable]$Headers = @{}
  )

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers
  }

  $json = $Body | ConvertTo-Json -Depth 25 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json; charset=utf-8" -Body $bytes
}

function Normalize-Text {
  param([string]$InputText)
  if ([string]::IsNullOrWhiteSpace($InputText)) {
    return ""
  }
  return ($InputText -replace "\s+", " ").Trim()
}

function Normalize-ViDisplay {
  param([string]$InputText)
  $value = Normalize-Text $InputText
  if ([string]::IsNullOrWhiteSpace($value)) {
    return ""
  }

  $rules = @(
    @{ pattern = 'khong day'; replacement = 'Không dây' },
    @{ pattern = 'co day'; replacement = 'Có dây' },
    @{ pattern = '\bphim\b'; replacement = 'phím' },
    @{ pattern = 'khong su dung pin'; replacement = 'Không sử dụng pin' },
    @{ pattern = 'van phong'; replacement = 'Văn phòng' },
    @{ pattern = 'nghe nhac'; replacement = 'Nghe nhạc' },
    @{ pattern = 'lam viec'; replacement = 'làm việc' },
    @{ pattern = 'da ket noi'; replacement = 'Đa kết nối' },
    @{ pattern = 'da muc dich'; replacement = 'Đa mục đích' }
  )

  foreach ($rule in $rules) {
    $value = [regex]::Replace(
      $value,
      $rule.pattern,
      $rule.replacement,
      [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
  }
  return $value
}

function Normalize-ColorDisplay {
  param([string]$ColorText)
  $value = Normalize-Text $ColorText
  if ([string]::IsNullOrWhiteSpace($value)) {
    return ""
  }

  switch ($value.ToLowerInvariant()) {
    "trang" { return "Trắng" }
    "den" { return "Đen" }
    "xam" { return "Xám" }
    "hong" { return "Hồng" }
    "do" { return "Đỏ" }
    default { return $value }
  }
}

function Normalize-Key {
  param([string]$RawKey)
  if ([string]::IsNullOrWhiteSpace($RawKey)) {
    return ""
  }

  $k = $RawKey.Replace("đ", "d").Replace("Đ", "D")
  $formD = $k.Normalize([System.Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $formD.ToCharArray()) {
    $cat = [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
    if ($cat -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($ch)
    }
  }
  $plain = $sb.ToString().Normalize([System.Text.NormalizationForm]::FormC)
  $plain = $plain.ToLowerInvariant()
  $plain = $plain -replace "[^a-z0-9]", ""
  return $plain
}

function Convert-HtmlToPlainText {
  param([string]$Html)
  if ([string]::IsNullOrWhiteSpace($Html)) {
    return ""
  }

  $decoded = [System.Net.WebUtility]::HtmlDecode($Html)
  $withoutTag = $decoded -replace "<[^>]+>", " "
  return Normalize-Text $withoutTag
}

function Convert-HtmlInlineToText {
  param([string]$Html)
  if ([string]::IsNullOrWhiteSpace($Html)) {
    return ""
  }

  $decoded = [System.Net.WebUtility]::HtmlDecode($Html)
  $decoded = $decoded -replace "(?i)<\s*br\s*/?\s*>", ", "
  $decoded = $decoded -replace "(?i)</\s*(p|div|li|ul|ol)\s*>", "; "
  $decoded = $decoded -replace "<[^>]+>", " "
  $decoded = Normalize-Text $decoded
  $decoded = $decoded.Trim()
  $decoded = $decoded.Trim(";", ",")
  return Normalize-Text $decoded
}

function Truncate-Text {
  param(
    [string]$Text,
    [int]$MaxLength
  )

  $value = Normalize-Text $Text
  if ([string]::IsNullOrWhiteSpace($value)) {
    return ""
  }
  if ($value.Length -le $MaxLength) {
    return $value
  }
  return $value.Substring(0, $MaxLength).Trim()
}

function Get-GearvnCoreSpecRows {
  param([string]$Sku)

  if ([string]::IsNullOrWhiteSpace($Sku)) {
    return @()
  }

  if ($script:gearCoreSpecCache.ContainsKey($Sku)) {
    return $script:gearCoreSpecCache[$Sku]
  }

  $rows = New-Object System.Collections.Generic.List[object]
  $uri = "https://cdp-embed-worker.cloud-gearvn.workers.dev/v1/js/product-specs?sku=$([uri]::EscapeDataString($Sku))&group_types=core&container=gvn-specs-core"

  try {
    $scriptContent = [string](Invoke-RestMethod -Method Get -Uri $uri)
    if ([string]::IsNullOrWhiteSpace($scriptContent) -or $scriptContent -match "No specs data") {
      $script:gearCoreSpecCache[$Sku] = @()
      return @()
    }

    $matches = [regex]::Matches(
      $scriptContent,
      "(?is)<tr[^>]*>\s*<th[^>]*>(?<label>[^<]+)</th>\s*<td[^>]*>(?<value>.*?)</td>\s*</tr>",
      [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    $seen = New-Object "System.Collections.Generic.HashSet[string]"
    foreach ($m in $matches) {
      $label = Convert-HtmlInlineToText $m.Groups["label"].Value
      $value = Convert-HtmlInlineToText $m.Groups["value"].Value
      if ([string]::IsNullOrWhiteSpace($label) -or [string]::IsNullOrWhiteSpace($value)) {
        continue
      }
      $key = Normalize-Key $label
      if ([string]::IsNullOrWhiteSpace($key) -or -not $seen.Add($key)) {
        continue
      }
      [void]$rows.Add([pscustomobject]@{
        label = $label
        value = $value
      })
    }
  }
  catch {
    $rows = New-Object System.Collections.Generic.List[object]
  }

  $result = $rows.ToArray()
  $script:gearCoreSpecCache[$Sku] = $result
  return $result
}

function Pick-SpecValue {
  param(
    [object[]]$Rows,
    [string[]]$Keys
  )

  if ($null -eq $Rows -or $Rows.Count -eq 0) {
    return ""
  }

  foreach ($hint in $Keys) {
    $needle = Normalize-Key $hint
    if ([string]::IsNullOrWhiteSpace($needle)) {
      continue
    }

    foreach ($row in $Rows) {
      $rowKey = Normalize-Key $row.label
      if ($rowKey -eq $needle) {
        return Normalize-Text $row.value
      }
    }

    foreach ($row in $Rows) {
      $rowKey = Normalize-Key $row.label
      if ($rowKey.Contains($needle) -or $needle.Contains($rowKey)) {
        return Normalize-Text $row.value
      }
    }
  }

  return ""
}

function Build-Description {
  param([object]$Product)

  $title = Normalize-Text $Product.title
  $vendor = Normalize-Text $Product.vendor
  $productType = Normalize-Text $Product.product_type

  $plain = Convert-HtmlToPlainText $Product.body_html
  if (-not [string]::IsNullOrWhiteSpace($plain)) {
    $maxLen = 300
    $snippet = $plain
    if ($snippet.Length -gt $maxLen) {
      $snippet = $snippet.Substring(0, $maxLen).Trim() + "..."
    }
    return "$title - $snippet"
  }

  if (-not [string]::IsNullOrWhiteSpace($vendor) -and -not [string]::IsNullOrWhiteSpace($productType)) {
    return "$title là sản phẩm $productType của $vendor, phù hợp sử dụng hằng ngày."
  }
  if (-not [string]::IsNullOrWhiteSpace($vendor)) {
    return "$title là sản phẩm chính hãng từ $vendor."
  }
  return "$title là sản phẩm chính hãng từ GearVN."
}

function Get-CollectionProducts {
  param(
    [string]$Handle,
    [int]$MaxCount = 200
  )

  $limit = 50
  $page = 1
  $items = New-Object System.Collections.Generic.List[object]

  while ($true) {
    $uri = "https://gearvn.com/collections/$Handle/products.json?include=metafields[product]&page=$page&limit=$limit"
    $resp = Invoke-RestMethod -Method Get -Uri $uri
    if ($null -eq $resp.products -or $resp.products.Count -eq 0) {
      break
    }

    foreach ($p in $resp.products) {
      $items.Add($p)
      if ($items.Count -ge $MaxCount) {
        return $items
      }
    }

    if ($resp.products.Count -lt $limit) {
      break
    }
    $page += 1
  }

  return $items
}

function Parse-Tags {
  param([string]$TagString)

  $map = @{}
  if ([string]::IsNullOrWhiteSpace($TagString)) {
    return $map
  }

  foreach ($raw in ($TagString -split ",")) {
    $part = Normalize-Text $raw
    if ([string]::IsNullOrWhiteSpace($part)) {
      continue
    }
    $idx = $part.IndexOf(":")
    if ($idx -lt 0) {
      continue
    }

    $keyRaw = Normalize-Text $part.Substring(0, $idx)
    $value = Normalize-Text $part.Substring($idx + 1)
    if ([string]::IsNullOrWhiteSpace($keyRaw) -or [string]::IsNullOrWhiteSpace($value)) {
      continue
    }

    $key = Normalize-Key $keyRaw
    if (-not [string]::IsNullOrWhiteSpace($key) -and -not $map.ContainsKey($key)) {
      $map[$key] = $value
    }
  }

  return $map
}

function Pick-TagValue {
  param(
    [hashtable]$Tags,
    [string[]]$Keys,
    [string]$Default = "Khong ap dung"
  )

  foreach ($k in $Keys) {
    $nk = Normalize-Key $k
    if ($Tags.ContainsKey($nk)) {
      $v = Normalize-Text $Tags[$nk]
      if (-not [string]::IsNullOrWhiteSpace($v)) {
        return $v
      }
    }
  }

  return $Default
}

function Build-WarrantyText {
  param([hashtable]$Tags)

  $raw = Pick-TagValue -Tags $Tags -Keys @("warranty_product", "warranty", "bao_hanh") -Default "12"
  $num = 0
  if ([int]::TryParse($raw, [ref]$num) -and $num -gt 0) {
    return "$num tháng chính hãng"
  }
  if (-not [string]::IsNullOrWhiteSpace($raw) -and $raw -ne "Khong ap dung") {
    return $raw
  }
  return "12 tháng chính hãng"
}

function Get-SeedFromText {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) {
    return 17
  }
  $seed = 0
  foreach ($ch in $Text.ToCharArray()) {
    $seed += [int][char]$ch
  }
  return [Math]::Abs($seed) + 17
}

function Pick-BySeed {
  param(
    [string[]]$Options,
    [int]$Seed,
    [int]$Shift = 0
  )
  if ($null -eq $Options -or $Options.Count -eq 0) {
    return "Khong ap dung"
  }
  $idx = [Math]::Abs(($Seed + $Shift) % $Options.Count)
  return $Options[$idx]
}

function Extract-RegexGroup {
  param(
    [string]$Text,
    [string]$Pattern
  )
  $m = [regex]::Match([string]$Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($m.Success -and $m.Groups.Count -gt 1) {
    return Normalize-Text $m.Groups[1].Value
  }
  return ""
}

function Guess-KeyboardLayout {
  param([string]$Title, [int]$Seed)
  $t = [string]$Title
  if ($t -match '(?i)\b(tkl|87)\b') { return "TKL 87 phím" }
  if ($t -match '(?i)\b(98)\b') { return "98 phím" }
  if ($t -match '(?i)\b(96)\b') { return "96 phím" }
  if ($t -match '(?i)\b(75)\b') { return "75%" }
  if ($t -match '(?i)\b(65)\b') { return "65%" }
  if ($t -match '(?i)\b(60)\b') { return "60%" }
  if ($t -match '(?i)\b(100|104)\b') { return "Fullsize 104 phím" }
  return Pick-BySeed -Options @("TKL 87 phím", "75%", "65%", "Fullsize 104 phím", "98 phím") -Seed $Seed -Shift 1
}

function Guess-KeyboardSwitch {
  param([string]$Title, [int]$Seed)
  $t = [string]$Title
  if ($t -match '(?i)magnetic|rapid') { return "Magnetic switch (Rapid Trigger)" }
  if ($t -match '(?i)optical') { return "Optical switch" }
  if ($t -match '(?i)\bred\b') { return "Red Linear switch" }
  if ($t -match '(?i)\bblue\b') { return "Blue Clicky switch" }
  if ($t -match '(?i)\bbrown\b') { return "Brown Tactile switch" }
  if ($t -match '(?i)\bsilver\b') { return "Silver Speed switch" }
  return Pick-BySeed -Options @("Red Linear switch", "Brown Tactile switch", "Blue Clicky switch", "Silver Speed switch") -Seed $Seed -Shift 3
}

function Guess-KeyboardConnection {
  param([string]$Title, [int]$Seed)
  $t = [string]$Title
  $wireless = ($t -match '(?i)khong day|wireless|bluetooth|2\.4')
  $wired = ($t -match '(?i)co day|wired|usb')
  if ($wireless -and $wired) { return "Tri-mode (USB-C / 2.4GHz / Bluetooth)" }
  if ($wireless) { return "Không dây 2.4GHz / Bluetooth" }
  return Pick-BySeed -Options @("USB có dây", "USB-C có dây", "Tri-mode (USB-C / 2.4GHz / Bluetooth)") -Seed $Seed -Shift 5
}

function Guess-Color {
  param([string]$Title, [int]$Seed)
  $t = [string]$Title
  if ($t -match '(?i)\bwhite|trang\b') { return "Trắng" }
  if ($t -match '(?i)\bblack|den\b') { return "Đen" }
  if ($t -match '(?i)\bgray|grey|xam\b') { return "Xám" }
  if ($t -match '(?i)\bpink|hong\b') { return "Hồng" }
  if ($t -match '(?i)\bblue|xanh\b') { return "Xanh" }
  if ($t -match '(?i)\bred|do\b') { return "Đỏ" }
  return Pick-BySeed -Options @("Đen", "Trắng", "Xám", "Xanh") -Seed $Seed -Shift 7
}

function Guess-LaptopCpu {
  param([string]$Title, [int]$Seed)
  $t = [string]$Title
  if ($t -match '(?i)ultra\s*9') { return "Intel Core Ultra 9" }
  if ($t -match '(?i)ultra\s*7') { return "Intel Core Ultra 7" }
  if ($t -match '(?i)ultra\s*5') { return "Intel Core Ultra 5" }
  if ($t -match '(?i)i9') { return "Intel Core i9" }
  if ($t -match '(?i)i7') { return "Intel Core i7" }
  if ($t -match '(?i)i5') { return "Intel Core i5" }
  if ($t -match '(?i)i3') { return "Intel Core i3" }
  if ($t -match '(?i)ryzen\s*9|r9') { return "AMD Ryzen 9" }
  if ($t -match '(?i)ryzen\s*7|r7') { return "AMD Ryzen 7" }
  if ($t -match '(?i)ryzen\s*5|r5') { return "AMD Ryzen 5" }
  if ($t -match '(?i)ryzen\s*3|r3') { return "AMD Ryzen 3" }
  if ($t -match '(?i)\bmacbook\b') { return "Apple Silicon" }
  return Pick-BySeed -Options @("Intel Core i5", "Intel Core i7", "AMD Ryzen 5", "AMD Ryzen 7") -Seed $Seed -Shift 11
}

function Guess-LaptopRam {
  param([string]$Title, [int]$Seed)
  $v = Extract-RegexGroup -Text $Title -Pattern '(?i)\b(8|16|24|32|64)\s*gb\b'
  if ($v) { return "$v GB DDR5" }
  return Pick-BySeed -Options @("8 GB DDR5", "16 GB DDR5", "32 GB DDR5") -Seed $Seed -Shift 13
}

function Guess-LaptopStorage {
  param([string]$Title, [int]$Seed)
  $tb = Extract-RegexGroup -Text $Title -Pattern '(?i)\b(1|2|4)\s*tb\b'
  if ($tb) { return "$tb TB SSD NVMe" }
  $gb = Extract-RegexGroup -Text $Title -Pattern '(?i)\b(256|512)\s*gb\b'
  if ($gb) { return "$gb GB SSD NVMe" }
  return Pick-BySeed -Options @("512 GB SSD NVMe", "1 TB SSD NVMe", "2 TB SSD NVMe") -Seed $Seed -Shift 17
}

function Guess-LaptopGpu {
  param([string]$Title, [int]$Seed)
  $t = [string]$Title
  if ($t -match '(?i)rtx\s*5090') { return "NVIDIA GeForce RTX 5090" }
  if ($t -match '(?i)rtx\s*5080') { return "NVIDIA GeForce RTX 5080" }
  if ($t -match '(?i)rtx\s*5070\s*ti') { return "NVIDIA GeForce RTX 5070 Ti" }
  if ($t -match '(?i)rtx\s*5070') { return "NVIDIA GeForce RTX 5070" }
  if ($t -match '(?i)rtx\s*5060\s*ti') { return "NVIDIA GeForce RTX 5060 Ti" }
  if ($t -match '(?i)rtx\s*5060') { return "NVIDIA GeForce RTX 5060" }
  if ($t -match '(?i)rtx\s*4050') { return "NVIDIA GeForce RTX 4050" }
  if ($t -match '(?i)rtx\s*4060') { return "NVIDIA GeForce RTX 4060" }
  if ($t -match '(?i)rtx\s*4070') { return "NVIDIA GeForce RTX 4070" }
  if ($t -match '(?i)rtx\s*3050') { return "NVIDIA GeForce RTX 3050" }
  if ($t -match '(?i)radeon') { return "AMD Radeon Graphics" }
  if ($t -match '(?i)macbook') { return "Apple GPU tích hợp" }
  return Pick-BySeed -Options @("Intel Iris Xe Graphics", "NVIDIA GeForce RTX 4050", "NVIDIA GeForce RTX 4060", "AMD Radeon Graphics") -Seed $Seed -Shift 19
}

function Guess-LaptopScreen {
  param([string]$Title, [int]$Seed)
  $inch = Extract-RegexGroup -Text $Title -Pattern '(?i)\b(13\.3|14|15\.6|16|17\.3)\s*(inch|")'
  if ($inch) {
    $panel = Pick-BySeed -Options @("IPS 144Hz", "OLED 2.8K 120Hz", "IPS Full HD 144Hz", "IPS 2.5K 165Hz") -Seed $Seed -Shift 23
    return "$inch inch $panel"
  }
  return Pick-BySeed -Options @("14 inch IPS Full HD", "15.6 inch IPS 144Hz", "16 inch OLED 2.5K", "14 inch OLED 2.8K") -Seed $Seed -Shift 29
}

function Guess-PhoneChip {
  param([string]$Title, [int]$Seed)
  $t = [string]$Title
  if ($t -match '(?i)snapdragon\s*8\s*elite') { return "Qualcomm Snapdragon 8 Elite" }
  if ($t -match '(?i)snapdragon\s*8\s*gen\s*3') { return "Qualcomm Snapdragon 8 Gen 3" }
  if ($t -match '(?i)snapdragon\s*8\s*gen\s*2') { return "Qualcomm Snapdragon 8 Gen 2" }
  if ($t -match '(?i)dimensity\s*9400') { return "MediaTek Dimensity 9400" }
  if ($t -match '(?i)dimensity\s*9300') { return "MediaTek Dimensity 9300" }
  if ($t -match '(?i)apple\s*a18\s*pro') { return "Apple A18 Pro" }
  if ($t -match '(?i)apple\s*a18') { return "Apple A18" }
  if ($t -match '(?i)apple\s*a17\s*pro') { return "Apple A17 Pro" }
  if ($t -match '(?i)tensor\s*g4') { return "Google Tensor G4" }
  return Pick-BySeed -Options @(
    "Qualcomm Snapdragon 8 Gen 3",
    "Qualcomm Snapdragon 8 Elite",
    "MediaTek Dimensity 9300",
    "Apple A18"
  ) -Seed $Seed -Shift 35
}

function Guess-PhoneRam {
  param([string]$Title, [int]$Seed)
  $v = Extract-RegexGroup -Text $Title -Pattern '(?i)\b(6|8|12|16|18|24)\s*gb\b'
  if ($v) { return "$v GB" }
  return Pick-BySeed -Options @("8 GB", "12 GB", "16 GB") -Seed $Seed -Shift 37
}

function Guess-PhoneStorage {
  param([string]$Title, [int]$Seed)
  $tb = Extract-RegexGroup -Text $Title -Pattern '(?i)\b(1|2)\s*tb\b'
  if ($tb) { return "$tb TB" }
  $gb = Extract-RegexGroup -Text $Title -Pattern '(?i)\b(128|256|512)\s*gb\b'
  if ($gb) { return "$gb GB" }
  return Pick-BySeed -Options @("256 GB", "512 GB", "1 TB") -Seed $Seed -Shift 39
}

function Guess-PhoneScreen {
  param([string]$Title, [int]$Seed)
  $inch = Extract-RegexGroup -Text $Title -Pattern '(?i)\b(6\.1|6\.2|6\.3|6\.4|6\.5|6\.6|6\.7|6\.8)\s*(inch|")'
  if ($inch) {
    $panel = Pick-BySeed -Options @("AMOLED FHD+ 120Hz", "LTPO OLED 120Hz", "OLED 1.5K 120Hz") -Seed $Seed -Shift 41
    return "$inch inch $panel"
  }
  return Pick-BySeed -Options @("6.1 inch OLED 120Hz", "6.7 inch AMOLED 120Hz", "6.8 inch LTPO OLED 120Hz") -Seed $Seed -Shift 43
}

function Guess-PhoneBattery {
  param([string]$Title, [int]$Seed)
  $mah = Extract-RegexGroup -Text $Title -Pattern '(?i)\b(4200|4500|4700|4800|5000|5100|5200|5500|6000)\s*mah\b'
  if ($mah) { return "$mah mAh" }
  return Pick-BySeed -Options @("4500 mAh", "5000 mAh", "5200 mAh", "5500 mAh") -Seed $Seed -Shift 45
}

function Guess-PhoneCamera {
  param([string]$Title, [int]$Seed)
  $mp = Extract-RegexGroup -Text $Title -Pattern '(?i)\b(48|50|64|108|200)\s*mp\b'
  if ($mp) { return "Camera chính $mp MP" }
  return Pick-BySeed -Options @("Camera chính 50 MP", "Camera chính 108 MP", "Camera chính 200 MP") -Seed $Seed -Shift 47
}

function Guess-PhoneOs {
  param([string]$Title)
  $t = [string]$Title
  if ($t -match '(?i)\biphone\b|\bapple\b') { return "iOS" }
  return "Android 15"
}

function Extract-LaptopCpuFromText {
  param([string]$SourceText)

  $text = Normalize-Text $SourceText
  if ([string]::IsNullOrWhiteSpace($text)) {
    return ""
  }

  $patterns = @(
    '(?i)(AMD\s+Ryzen(?:\s+AI)?(?:\s+[A-Za-z0-9\+\-]+){0,6}\s*\([^)]{0,120}\))',
    '(?i)(Intel\s+Core(?:\s+Ultra)?(?:\s+[A-Za-z0-9\+\-]+){0,6}\s*\([^)]{0,120}\))',
    '(?i)(AMD\s+Ryzen(?:\s+AI)?(?:\s+[A-Za-z0-9\+\-]+){1,5})',
    '(?i)(Intel\s+Core(?:\s+Ultra)?(?:\s+[A-Za-z0-9\+\-]+){1,5})',
    '(?i)(Apple\s+M[1-9][A-Za-z0-9\s\-]{0,20})'
  )

  foreach ($pattern in $patterns) {
    $value = Extract-RegexGroup -Text $text -Pattern $pattern
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      $value = Normalize-Text $value
      $value = $value -replace '\s+[A-Za-z]$', ''
      return Normalize-Text $value
    }
  }

  return ""
}

function Extract-LaptopGpuFromText {
  param([string]$SourceText)

  $text = Normalize-Text $SourceText
  if ([string]::IsNullOrWhiteSpace($text)) {
    return ""
  }

  $patterns = @(
    '(?i)(NVIDIA(?:®)?\s+GeForce\s+RTX(?:™)?\s*\d{3,4}(?:\s*Ti)?(?:\s*\d+\s*GB(?:\s*GDDR[0-9X]+)?)?(?:\s*\([^)]{0,80}\))?)',
    '(?i)(NVIDIA(?:®)?\s+GeForce\s+GTX\s*\d{3,4}(?:\s*Ti)?(?:\s*\d+\s*GB(?:\s*GDDR[0-9X]+)?)?(?:\s*\([^)]{0,80}\))?)',
    '(?i)(RTX\s*\d{3,4}(?:\s*Ti)?(?:\s*\d+\s*GB(?:\s*GDDR[0-9X]+)?)?(?:\s*\([^)]{0,80}\))?)',
    '(?i)(AMD\s+Radeon(?:\s+[A-Za-z0-9\+\-]+){0,6}(?:\s*\([^)]{0,80}\))?)',
    '(?i)(Intel\s+Iris(?:\s+[A-Za-z0-9\+\-]+){0,6}(?:\s*\([^)]{0,80}\))?)'
  )

  foreach ($pattern in $patterns) {
    $value = Extract-RegexGroup -Text $text -Pattern $pattern
    if ([string]::IsNullOrWhiteSpace($value)) {
      continue
    }

    $value = Normalize-Text $value
    $value = $value -replace '(?i)^card\s+do\s+hoa\s*(roi)?\s*', ''
    $value = $value -replace '(?i)^do\s+hoa\s*', ''
    $value = $value -replace '\s+[A-Za-z]$', ''
    $value = Normalize-Text $value
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value
    }
  }

  return ""
}

function Guess-HeadphoneConnection {
  param([string]$Title, [int]$Seed)
  $t = [string]$Title
  $wireless = ($t -match '(?i)wireless|khong day|bluetooth|2\.4')
  $wired = ($t -match '(?i)wired|co day|3\.5|usb')
  if ($wireless -and $wired) { return "2.4GHz + Bluetooth + Có dây 3.5mm" }
  if ($wireless) { return "Bluetooth 5.3 / 2.4GHz" }
  return Pick-BySeed -Options @("Có dây 3.5mm", "USB", "Có dây 3.5mm + USB") -Seed $Seed -Shift 31
}

function Guess-AccessoryType {
  param([string]$Title, [string]$ProductType)
  $t = ("$Title $ProductType")
  if ($t -match '(?i)micro|microphone|seiren|quadcast|solocast|wave') { return "microphone" }
  if ($t -match '(?i)chuot|mouse|deathadder|g pro') { return "mouse" }
  if ($t -match '(?i)sac du phong|power bank|mah') { return "powerbank" }
  if ($t -match '(?i)cap|cable|hdmi|displayport|usb-c') { return "cable" }
  if ($t -match '(?i)loa|speaker') { return "speaker" }
  if ($t -match '(?i)hub|dock') { return "hub" }
  return "generic"
}

function Build-Specs {
  param(
    [object]$Product,
    [string]$CategoryName
  )

  $title = Normalize-Text $Product.title
  $tags = Parse-Tags $Product.tags
  $vendor = Normalize-Text $Product.vendor
  $productType = Normalize-Text $Product.product_type
  $seed = Get-SeedFromText -Text "$title|$vendor|$productType"

  $variant = $null
  if ($null -ne $Product.variants -and $Product.variants.Count -gt 0) {
    $variant = $Product.variants[0]
  }

  $warrantyText = Build-WarrantyText -Tags $tags

  $cpu = ""
  $ram = ""
  $storage = ""
  $gpu = ""
  $screen = ""
  $battery = ""
  $camera = ""
  $operatingSystem = ""

  $quick = New-Object System.Collections.Generic.List[string]
  $detail = New-Object System.Collections.Generic.List[string]
  $sku = if ($null -ne $variant -and $variant.sku) { Normalize-Text $variant.sku } else { "GVN-SKU-$seed" }
  $barcode = if ($null -ne $variant -and $variant.barcode) { Normalize-Text $variant.barcode } else { "GVN-BAR-$seed" }

  if ($CategoryName -eq "Ban phim") {
    $layout = Pick-TagValue -Tags $tags -Keys @("filter_kich_thuoc", "filter_layout", "filter_form") -Default ""
    if (-not $layout) { $layout = Guess-KeyboardLayout -Title $title -Seed $seed }
    $layout = Normalize-ViDisplay $layout

    $switchType = Pick-TagValue -Tags $tags -Keys @("filter_loai_switch", "filter_switch", "hl_switch") -Default ""
    if (-not $switchType) { $switchType = Guess-KeyboardSwitch -Title $title -Seed $seed }

    $connection = Pick-TagValue -Tags $tags -Keys @("filter_loai_ket_noi", "filter_cong_ket_noi", "hl_connect", "hl_connector") -Default ""
    if (-not $connection) { $connection = Guess-KeyboardConnection -Title $title -Seed $seed }
    $connection = Normalize-ViDisplay $connection

    $led = Pick-TagValue -Tags $tags -Keys @("filter_led", "filter_den_led") -Default ""
    if (-not $led) { $led = Pick-BySeed -Options @("RGB 16.8 trieu mau", "Per-key RGB", "Single color LED") -Seed $seed -Shift 37 }

    $color = Pick-TagValue -Tags $tags -Keys @("filter_mau_sac") -Default ""
    if (-not $color) { $color = Guess-Color -Title $title -Seed $seed }
    $color = Normalize-ColorDisplay $color

    $usage = Pick-TagValue -Tags $tags -Keys @("filter_nhu_cau_su_dung") -Default ""
    if (-not $usage) {
      if (($title -match '(?i)gaming|esport')) { $usage = "Gaming/Esports" } else { $usage = "Gaming + Văn phòng" }
    }
    $usage = Normalize-ViDisplay $usage

    $keycap = Pick-TagValue -Tags $tags -Keys @("filter_keycap") -Default ""
    if (-not $keycap) { $keycap = Pick-BySeed -Options @("PBT Double-shot", "ABS Laser-etched", "PBT Dye-sub") -Seed $seed -Shift 41 }
    $keycap = Normalize-ViDisplay $keycap

    $keyboardBattery = if ($connection -match '(?i)bluetooth|khong day|2\.4') { Pick-BySeed -Options @("4000mAh", "3000mAh", "2500mAh") -Seed $seed -Shift 43 } else { "Không sử dụng pin (có dây)" }
    $keyboardBattery = Normalize-ViDisplay $keyboardBattery

    [void]$quick.Add("Layout: $layout")
    [void]$quick.Add("Switch: $switchType")
    [void]$quick.Add("Kết nối: $connection")
    [void]$quick.Add("LED: $led")
    [void]$quick.Add("Màu sắc: $color")
    [void]$quick.Add("Keycap: $keycap")
    [void]$quick.Add("Pin: $keyboardBattery")
    [void]$quick.Add("Bảo hành: $warrantyText")

    [void]$detail.Add("Thương hiệu: $(if([string]::IsNullOrWhiteSpace($vendor)){'Không áp dụng'}else{$vendor})")
    [void]$detail.Add("Loại sản phẩm: $(if([string]::IsNullOrWhiteSpace($productType)){'Bàn phím'}else{$productType})")
    [void]$detail.Add("Layout: $layout")
    [void]$detail.Add("Loại switch: $switchType")
    [void]$detail.Add("Kết nối: $connection")
    [void]$detail.Add("LED: $led")
    [void]$detail.Add("Màu sắc: $color")
    [void]$detail.Add("Keycap: $keycap")
    [void]$detail.Add("Nhu cầu sử dụng: $usage")
    [void]$detail.Add("Pin: $keyboardBattery")
    [void]$detail.Add("SKU: $sku")
    [void]$detail.Add("Barcode: $barcode")
    [void]$detail.Add("Bảo hành: $warrantyText")
  }
  elseif ($CategoryName -eq "Tai nghe") {
    $connection = Pick-TagValue -Tags $tags -Keys @("filter_loai_ket_noi", "filter_cong_ket_noi", "hl_connect", "hl_connector") -Default ""
    if (-not $connection) { $connection = Guess-HeadphoneConnection -Title $title -Seed $seed }
    $connection = Normalize-ViDisplay $connection

    $style = Pick-TagValue -Tags $tags -Keys @("filter_kieu_tai_nghe", "hl_typehp") -Default ""
    if (-not $style) {
      if ($title -match '(?i)in-ear|earbuds') { $style = "In-ear" }
      elseif ($title -match '(?i)on-ear') { $style = "On-ear" }
      else { $style = "Over-ear" }
    }

    $usage = Pick-TagValue -Tags $tags -Keys @("filter_nhu_cau_su_dung") -Default ""
    if (-not $usage) {
      if ($title -match '(?i)gaming') { $usage = "Gaming/Esports" } else { $usage = "Nghe nhạc + làm việc" }
    }
    $usage = Normalize-ViDisplay $usage

    $color = Pick-TagValue -Tags $tags -Keys @("filter_mau_sac") -Default ""
    if (-not $color) { $color = Guess-Color -Title $title -Seed $seed }
    $color = Normalize-ColorDisplay $color

    $driver = Extract-RegexGroup -Text $title -Pattern '(?i)\b(40|45|50|53)\s*mm\b'
    if (-not $driver) { $driver = Pick-BySeed -Options @("40", "50", "53") -Seed $seed -Shift 47 }
    $driverText = "$driver mm neodymium"

    $mic = if ($title -match '(?i)khong mic|without mic') { "Không tích hợp mic" } else { "Mic khử ồn, thu âm rõ" }
    $latency = Pick-BySeed -Options @("< 20 ms", "< 35 ms", "< 45 ms") -Seed $seed -Shift 53
    $headphoneBattery = if ($connection -match '(?i)bluetooth|2\.4|khong day') { Pick-BySeed -Options @("30 giờ", "40 giờ", "60 giờ", "70 giờ") -Seed $seed -Shift 59 } else { "Không sử dụng pin (có dây)" }
    $headphoneBattery = Normalize-ViDisplay $headphoneBattery

    [void]$quick.Add("Kiểu tai nghe: $style")
    [void]$quick.Add("Driver: $driverText")
    [void]$quick.Add("Kết nối: $connection")
    [void]$quick.Add("Độ trễ: $latency")
    [void]$quick.Add("Nhu cầu: $usage")
    [void]$quick.Add("Màu sắc: $color")
    [void]$quick.Add("Micro: $mic")
    [void]$quick.Add("Bảo hành: $warrantyText")

    [void]$detail.Add("Thương hiệu: $(if([string]::IsNullOrWhiteSpace($vendor)){'Không áp dụng'}else{$vendor})")
    [void]$detail.Add("Loại sản phẩm: $(if([string]::IsNullOrWhiteSpace($productType)){'Tai nghe'}else{$productType})")
    [void]$detail.Add("Kiểu tai nghe: $style")
    [void]$detail.Add("Driver: $driverText")
    [void]$detail.Add("Kết nối: $connection")
    [void]$detail.Add("Độ trễ truyền tải: $latency")
    [void]$detail.Add("Micro: $mic")
    [void]$detail.Add("Pin: $headphoneBattery")
    [void]$detail.Add("Nhu cầu sử dụng: $usage")
    [void]$detail.Add("Màu sắc: $color")
    [void]$detail.Add("SKU: $sku")
    [void]$detail.Add("Barcode: $barcode")
    [void]$detail.Add("Bảo hành: $warrantyText")
  }
  elseif ($CategoryName -eq "Dien thoai") {
    $phoneCoreRows = @(Get-GearvnCoreSpecRows -Sku $sku)

    $chipFromCore = Pick-SpecValue -Rows $phoneCoreRows -Keys @("chipset", "chip", "cpu", "vi_xu_ly", "bo_vi_xu_ly")
    $ramFromCore = Pick-SpecValue -Rows $phoneCoreRows -Keys @("ram")
    $storageFromCore = Pick-SpecValue -Rows $phoneCoreRows -Keys @("bo_nho_trong", "rom", "dung_luong_luu_tru", "storage", "luu_tru")
    $gpuFromCore = Pick-SpecValue -Rows $phoneCoreRows -Keys @("gpu", "card_do_hoa")
    $screenFromCore = Pick-SpecValue -Rows $phoneCoreRows -Keys @("man_hinh", "kich_thuoc_man_hinh", "screen")
    $resolutionFromCore = Pick-SpecValue -Rows $phoneCoreRows -Keys @("do_phan_giai")
    $refreshRateFromCore = Pick-SpecValue -Rows $phoneCoreRows -Keys @("tan_so_quet")
    $batteryFromCore = Pick-SpecValue -Rows $phoneCoreRows -Keys @("pin", "dung_luong_pin")
    $cameraFromCore = Pick-SpecValue -Rows $phoneCoreRows -Keys @("camera_sau", "camera_truoc", "camera")
    $osFromCore = Pick-SpecValue -Rows $phoneCoreRows -Keys @("he_dieu_hanh", "os")

    $chipOpt = Pick-TagValue -Tags $tags -Keys @("filter_cpu", "hl_cpu", "cpu", "chipset") -Default ""
    if (-not $chipOpt) { $chipOpt = Guess-PhoneChip -Title $title -Seed $seed }
    if ($chipFromCore) { $chipOpt = $chipFromCore }

    $ramOpt = Pick-TagValue -Tags $tags -Keys @("filter_ram", "hl_ram", "ram") -Default ""
    if (-not $ramOpt) { $ramOpt = Guess-PhoneRam -Title $title -Seed $seed }
    if ($ramFromCore) { $ramOpt = $ramFromCore }

    $storageOpt = Pick-TagValue -Tags $tags -Keys @("filter_storage", "filter_ocung", "rom", "storage") -Default ""
    if (-not $storageOpt) { $storageOpt = Guess-PhoneStorage -Title $title -Seed $seed }
    if ($storageFromCore) { $storageOpt = $storageFromCore }

    $screenOpt = Pick-TagValue -Tags $tags -Keys @("filter_manhinh", "screen", "man_hinh") -Default ""
    if (-not $screenOpt) { $screenOpt = Guess-PhoneScreen -Title $title -Seed $seed }
    if ($screenFromCore) {
      $screenParts = New-Object System.Collections.Generic.List[string]
      [void]$screenParts.Add($screenFromCore)
      if ($resolutionFromCore) { [void]$screenParts.Add($resolutionFromCore) }
      if ($refreshRateFromCore) { [void]$screenParts.Add($refreshRateFromCore) }
      $screenOpt = @($screenParts | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique) -join " | "
    }

    $batteryOpt = Guess-PhoneBattery -Title $title -Seed $seed
    if ($batteryFromCore) { $batteryOpt = $batteryFromCore }

    $cameraOpt = Guess-PhoneCamera -Title $title -Seed $seed
    if ($cameraFromCore) { $cameraOpt = $cameraFromCore }

    $osOpt = Guess-PhoneOs -Title $title
    if ($osFromCore) { $osOpt = $osFromCore }

    $gpuOpt = if ([string]::IsNullOrWhiteSpace($gpuFromCore)) { "GPU tích hợp trong chipset" } else { $gpuFromCore }

    $cpu = Truncate-Text -Text $chipOpt -MaxLength 180
    $ram = Truncate-Text -Text $ramOpt -MaxLength 120
    $storage = Truncate-Text -Text $storageOpt -MaxLength 120
    $gpu = Truncate-Text -Text $gpuOpt -MaxLength 180
    $screen = Truncate-Text -Text $screenOpt -MaxLength 180
    $battery = Truncate-Text -Text $batteryOpt -MaxLength 180
    $camera = Truncate-Text -Text $cameraOpt -MaxLength 180
    $operatingSystem = Truncate-Text -Text $osOpt -MaxLength 120

    [void]$quick.Add("Chip: $cpu")
    [void]$quick.Add("RAM: $ram")
    [void]$quick.Add("Bộ nhớ: $storage")
    [void]$quick.Add("Màn hình: $screen")
    [void]$quick.Add("Camera: $camera")
    [void]$quick.Add("Pin: $battery")
    [void]$quick.Add("Hệ điều hành: $operatingSystem")
    [void]$quick.Add("Bảo hành: $warrantyText")

    [void]$detail.Add("Thương hiệu: $(if([string]::IsNullOrWhiteSpace($vendor)){'Không áp dụng'}else{$vendor})")
    [void]$detail.Add("Loại sản phẩm: $(if([string]::IsNullOrWhiteSpace($productType)){'Thiết bị công nghệ'}else{$productType})")

    if ($null -ne $phoneCoreRows -and $phoneCoreRows.Count -gt 0) {
      foreach ($row in $phoneCoreRows) {
        [void]$detail.Add("$($row.label): $($row.value)")
      }
    }
    else {
      [void]$detail.Add("Chip: $cpu")
      [void]$detail.Add("RAM: $ram")
      [void]$detail.Add("Bộ nhớ trong: $storage")
      [void]$detail.Add("GPU: $gpu")
      [void]$detail.Add("Màn hình: $screen")
      [void]$detail.Add("Camera: $camera")
      [void]$detail.Add("Pin: $battery")
      [void]$detail.Add("Hệ điều hành: $operatingSystem")
    }

    [void]$detail.Add("SKU: $sku")
    [void]$detail.Add("Barcode: $barcode")
    [void]$detail.Add("Bảo hành: $warrantyText")
  }
  elseif ($CategoryName -eq "Phu kien") {
    $connection = Pick-TagValue -Tags $tags -Keys @("filter_cong_ket_noi", "filter_loai_ket_noi", "hl_connect", "hl_connector") -Default ""
    $usage = Pick-TagValue -Tags $tags -Keys @("filter_nhu_cau_su_dung") -Default ""
    $color = Pick-TagValue -Tags $tags -Keys @("filter_mau_sac") -Default ""
    $model = Pick-TagValue -Tags $tags -Keys @("id_nhanh", "id_gearvn") -Default ""
    if (-not $model) { $model = "MODEL-$seed" }
    if (-not $color) { $color = Guess-Color -Title $title -Seed $seed }
    $color = Normalize-ColorDisplay $color

    $type = Guess-AccessoryType -Title $title -ProductType $productType
    if (-not $connection) {
      if ($type -eq "powerbank") { $connection = "USB-C / USB-A" }
      elseif ($type -eq "cable") { $connection = "USB-C / HDMI / DisplayPort" }
      elseif ($type -eq "microphone") { $connection = "USB-C / USB-A" }
      elseif ($type -eq "mouse") { $connection = "2.4GHz / Bluetooth / USB" }
      else { $connection = "Đa kết nối" }
    }
    if (-not $usage) {
      if ($type -eq "mouse") { $usage = "Gaming + Văn phòng" } else { $usage = "Đa mục đích" }
    }
    $connection = Normalize-ViDisplay $connection
    $usage = Normalize-ViDisplay $usage

    if ($type -eq "microphone") {
      $sampleRate = Pick-BySeed -Options @("24-bit/96kHz", "16-bit/48kHz", "24-bit/48kHz") -Seed $seed -Shift 61

      [void]$quick.Add("Loại: Microphone condenser")
      [void]$quick.Add("Tần số lấy mẫu: $sampleRate")
      [void]$quick.Add("Kết nối: $connection")
      [void]$quick.Add("Độ nhạy: -38 dB")
      [void]$quick.Add("Màu sắc: $color")
      [void]$quick.Add("Bảo hành: $warrantyText")

      [void]$detail.Add("Thương hiệu: $(if([string]::IsNullOrWhiteSpace($vendor)){'Không áp dụng'}else{$vendor})")
      [void]$detail.Add("Loại sản phẩm: Microphone")
      [void]$detail.Add("Kiểu thu âm: Cardioid")
      [void]$detail.Add("Tần số lấy mẫu: $sampleRate")
      [void]$detail.Add("Kết nối: $connection")
      [void]$detail.Add("Độ nhạy: -38 dB")
      [void]$detail.Add("Màu sắc: $color")
      [void]$detail.Add("SKU: $sku")
      [void]$detail.Add("Barcode: $barcode")
      [void]$detail.Add("Bảo hành: $warrantyText")
    }
    elseif ($type -eq "mouse") {
      $dpi = Extract-RegexGroup -Text $title -Pattern '(?i)\b(12000|16000|20000|26000|30000)\s*dpi\b'
      if (-not $dpi) { $dpi = Pick-BySeed -Options @("12000", "16000", "26000", "30000") -Seed $seed -Shift 67 }
      $buttonCount = Pick-BySeed -Options @("6", "7", "8") -Seed $seed -Shift 73
      $switchLife = Pick-BySeed -Options @("50 trieu lan nhan", "80 trieu lan nhan", "100 trieu lan nhan") -Seed $seed -Shift 71
      $mouseBattery = if ($connection -match '(?i)bluetooth|2\.4') { Pick-BySeed -Options @("70 giờ", "90 giờ", "120 giờ") -Seed $seed -Shift 79 } else { "Không sử dụng pin (có dây)" }
      $mouseBattery = Normalize-ViDisplay $mouseBattery

      [void]$quick.Add("Loại: Chuột")
      [void]$quick.Add("DPI tối đa: $dpi DPI")
      [void]$quick.Add("Số nút: $buttonCount")
      [void]$quick.Add("Kết nối: $connection")
      [void]$quick.Add("Polling rate: 1000Hz")
      [void]$quick.Add("Pin: $mouseBattery")
      [void]$quick.Add("Bảo hành: $warrantyText")

      [void]$detail.Add("Thương hiệu: $(if([string]::IsNullOrWhiteSpace($vendor)){'Không áp dụng'}else{$vendor})")
      [void]$detail.Add("Loại sản phẩm: Chuột")
      [void]$detail.Add("Cảm biến: Quang học")
      [void]$detail.Add("DPI tối đa: $dpi DPI")
      [void]$detail.Add("Số nút: $buttonCount")
      [void]$detail.Add("Polling rate: 1000Hz")
      [void]$detail.Add("Độ bền switch: $switchLife")
      [void]$detail.Add("Kết nối: $connection")
      [void]$detail.Add("Pin: $mouseBattery")
      [void]$detail.Add("Màu sắc: $color")
      [void]$detail.Add("Nhu cầu sử dụng: $usage")
      [void]$detail.Add("SKU: $sku")
      [void]$detail.Add("Barcode: $barcode")
      [void]$detail.Add("Bảo hành: $warrantyText")
    }
    elseif ($type -eq "powerbank") {
      $mah = Extract-RegexGroup -Text $title -Pattern '(?i)\b(5000|10000|12000|20000|24000|25000)\s*mah\b'
      if (-not $mah) { $mah = Pick-BySeed -Options @("10000", "20000", "25000") -Seed $seed -Shift 83 }
      $watt = Pick-BySeed -Options @("20W", "30W", "45W", "65W") -Seed $seed -Shift 89

      [void]$quick.Add("Loại: Sạc dự phòng")
      [void]$quick.Add("Dung lượng: $mah mAh")
      [void]$quick.Add("Công suất tối đa: $watt")
      [void]$quick.Add("Cổng kết nối: $connection")
      [void]$quick.Add("Hỗ trợ sạc nhanh: PD/QC")
      [void]$quick.Add("Màu sắc: $color")
      [void]$quick.Add("Bảo hành: $warrantyText")

      [void]$detail.Add("Thương hiệu: $(if([string]::IsNullOrWhiteSpace($vendor)){'Không áp dụng'}else{$vendor})")
      [void]$detail.Add("Loại sản phẩm: Sạc dự phòng")
      [void]$detail.Add("Dung lượng pin: $mah mAh")
      [void]$detail.Add("Công suất tối đa: $watt")
      [void]$detail.Add("Cổng kết nối: $connection")
      [void]$detail.Add("Chuẩn sạc nhanh: PD/QC")
      [void]$detail.Add("Màu sắc: $color")
      [void]$detail.Add("Nhu cầu sử dụng: $usage")
      [void]$detail.Add("SKU: $sku")
      [void]$detail.Add("Barcode: $barcode")
      [void]$detail.Add("Bảo hành: $warrantyText")
    }
    elseif ($type -eq "cable") {
      $length = Extract-RegexGroup -Text $title -Pattern '(?i)\b(0\.5|1|1\.5|2|3)\s*m\b'
      if (-not $length) { $length = Pick-BySeed -Options @("1", "1.5", "2") -Seed $seed -Shift 97 }
      $bandwidth = Pick-BySeed -Options @("USB 3.2 Gen 2", "USB 3.2 Gen 1", "HDMI 2.1", "DisplayPort 1.4") -Seed $seed -Shift 101
      $jacket = Pick-BySeed -Options @("Nylon braided", "PVC mem", "TPE") -Seed $seed -Shift 103

      [void]$quick.Add("Loại: Cáp kết nối")
      [void]$quick.Add("Độ dài: $length m")
      [void]$quick.Add("Đầu kết nối: $connection")
      [void]$quick.Add("Băng thông/chuẩn: $bandwidth")
      [void]$quick.Add("Vỏ cáp: $jacket")
      [void]$quick.Add("Màu sắc: $color")
      [void]$quick.Add("Bảo hành: $warrantyText")

      [void]$detail.Add("Thương hiệu: $(if([string]::IsNullOrWhiteSpace($vendor)){'Không áp dụng'}else{$vendor})")
      [void]$detail.Add("Loại sản phẩm: Cáp kết nối")
      [void]$detail.Add("Độ dài cáp: $length m")
      [void]$detail.Add("Đầu kết nối: $connection")
      [void]$detail.Add("Chuẩn truyền dữ liệu: $bandwidth")
      [void]$detail.Add("Chất liệu vỏ cáp: $jacket")
      [void]$detail.Add("Màu sắc: $color")
      [void]$detail.Add("Nhu cầu sử dụng: $usage")
      [void]$detail.Add("SKU: $sku")
      [void]$detail.Add("Barcode: $barcode")
      [void]$detail.Add("Bảo hành: $warrantyText")
    }
    else {
      [void]$quick.Add("Loại sản phẩm: $(if([string]::IsNullOrWhiteSpace($productType)){'Phụ kiện'}else{$productType})")
      [void]$quick.Add("Kết nối: $connection")
      [void]$quick.Add("Màu sắc: $color")
      [void]$quick.Add("Nhu cầu: $usage")
      [void]$quick.Add("Mã model/nội bộ: $model")
      [void]$quick.Add("Bảo hành: $warrantyText")

      [void]$detail.Add("Thương hiệu: $(if([string]::IsNullOrWhiteSpace($vendor)){'Không áp dụng'}else{$vendor})")
      [void]$detail.Add("Loại sản phẩm: $(if([string]::IsNullOrWhiteSpace($productType)){'Phụ kiện'}else{$productType})")
      [void]$detail.Add("Kết nối: $connection")
      [void]$detail.Add("Nhu cầu sử dụng: $usage")
      [void]$detail.Add("Màu sắc: $color")
      [void]$detail.Add("Mã model/nội bộ: $model")
      [void]$detail.Add("SKU: $sku")
      [void]$detail.Add("Barcode: $barcode")
      [void]$detail.Add("Bảo hành: $warrantyText")
    }
  }
  else {
    $gearCoreRows = @(Get-GearvnCoreSpecRows -Sku $sku)
    $laptopBodyText = Convert-HtmlToPlainText $Product.body_html

    $cpuFromCore = Pick-SpecValue -Rows $gearCoreRows -Keys @("cpu", "bo_vi_xu_ly", "vi_xu_ly", "chip")
    $ramFromCore = Pick-SpecValue -Rows $gearCoreRows -Keys @("ram")
    $storageFromCore = Pick-SpecValue -Rows $gearCoreRows -Keys @("ssd", "o_cung", "luu_tru", "storage")
    $gpuFromCore = Pick-SpecValue -Rows $gearCoreRows -Keys @("card_do_hoa", "card_man_hinh", "gpu", "vga", "do_hoa")
    $screenFromCore = Pick-SpecValue -Rows $gearCoreRows -Keys @("man_hinh", "kich_thuoc_man_hinh", "kich_thuoc", "screen")
    $resolutionFromCore = Pick-SpecValue -Rows $gearCoreRows -Keys @("do_phan_giai")
    $refreshRateFromCore = Pick-SpecValue -Rows $gearCoreRows -Keys @("tan_so_quet")
    $batteryFromCore = Pick-SpecValue -Rows $gearCoreRows -Keys @("pin")
    $cameraFromCore = Pick-SpecValue -Rows $gearCoreRows -Keys @("webcam", "camera")
    $osFromCore = Pick-SpecValue -Rows $gearCoreRows -Keys @("he_dieu_hanh")
    $cpuFromBody = Extract-LaptopCpuFromText "$title $laptopBodyText"
    $gpuFromBody = Extract-LaptopGpuFromText "$title $laptopBodyText"

    $cpuModel = Pick-TagValue -Tags $tags -Keys @("filter_cpu", "hl_cpu", "cpu") -Default ""
    if (-not $cpuModel) { $cpuModel = $cpuFromBody }
    if (-not $cpuModel) { $cpuModel = Guess-LaptopCpu -Title $title -Seed $seed }
    if ($cpuFromCore) { $cpuModel = $cpuFromCore }

    $ramOpt = Pick-TagValue -Tags $tags -Keys @("filter_ram", "hl_ram", "ram") -Default ""
    if (-not $ramOpt) { $ramOpt = Guess-LaptopRam -Title $title -Seed $seed }
    if ($ramFromCore) { $ramOpt = $ramFromCore }

    $storageOpt = Pick-TagValue -Tags $tags -Keys @("filter_ocung", "filter_storage", "hl_ssd", "ssd", "storage") -Default ""
    if (-not $storageOpt) { $storageOpt = Guess-LaptopStorage -Title $title -Seed $seed }
    if ($storageFromCore) { $storageOpt = $storageFromCore }

    $gpuOpt = Pick-TagValue -Tags $tags -Keys @("filter_vga", "filter_gpu", "hl_vga", "hl_gpu", "vga", "gpu") -Default ""
    if (-not $gpuOpt) { $gpuOpt = $gpuFromBody }
    if (-not $gpuOpt) { $gpuOpt = Guess-LaptopGpu -Title $title -Seed $seed }
    if ($gpuFromCore) { $gpuOpt = $gpuFromCore }

    $screenSize = Pick-TagValue -Tags $tags -Keys @("filter_manhinh", "filter_kichthuoc", "hl_lcd", "screen", "man_hinh") -Default ""
    if (-not $screenSize) { $screenSize = Guess-LaptopScreen -Title $title -Seed $seed }
    if ($screenFromCore) {
      $screenParts = New-Object System.Collections.Generic.List[string]
      [void]$screenParts.Add($screenFromCore)
      if ($resolutionFromCore) { [void]$screenParts.Add($resolutionFromCore) }
      if ($refreshRateFromCore) { [void]$screenParts.Add($refreshRateFromCore) }
      $screenSize = @($screenParts | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique) -join " | "
    }

    $osOpt = Pick-TagValue -Tags $tags -Keys @("filter_hedieuhanh") -Default ""
    if (-not $osOpt) { $osOpt = if ($title -match '(?i)macbook|apple') { "macOS" } else { "Windows 11" } }
    if ($osFromCore) { $osOpt = $osFromCore }

    $battery = Pick-BySeed -Options @("56Wh", "70Wh", "80Wh", "90Wh") -Seed $seed -Shift 101
    $camera = Pick-BySeed -Options @("HD 720p", "Full HD 1080p", "IR camera") -Seed $seed -Shift 103
    if ($batteryFromCore) { $battery = $batteryFromCore }
    if ($cameraFromCore) { $camera = $cameraFromCore }

    $cpu = Truncate-Text -Text $cpuModel -MaxLength 180
    $ram = Truncate-Text -Text $ramOpt -MaxLength 120
    $storage = Truncate-Text -Text $storageOpt -MaxLength 120
    $gpu = Truncate-Text -Text $gpuOpt -MaxLength 180
    $screen = Truncate-Text -Text $screenSize -MaxLength 180
    $battery = Truncate-Text -Text $battery -MaxLength 180
    $camera = Truncate-Text -Text $camera -MaxLength 180
    $operatingSystem = Truncate-Text -Text $osOpt -MaxLength 120

    [void]$quick.Add("CPU: $cpu")
    [void]$quick.Add("RAM: $ram")
    [void]$quick.Add("Lưu trữ: $storage")
    [void]$quick.Add("Card đồ hoạ: $gpu")
    [void]$quick.Add("Màn hình: $screen")
    [void]$quick.Add("Pin: $battery")
    [void]$quick.Add("Bảo hành: $warrantyText")

    [void]$detail.Add("Thương hiệu: $(if([string]::IsNullOrWhiteSpace($vendor)){'Không áp dụng'}else{$vendor})")
    [void]$detail.Add("Loại sản phẩm: $(if([string]::IsNullOrWhiteSpace($productType)){'Laptop'}else{$productType})")

    if ($null -ne $gearCoreRows -and $gearCoreRows.Count -gt 0) {
      foreach ($row in $gearCoreRows) {
        $lineLabel = if ((Normalize-Key $row.label) -eq "carddohoa") { "Card đồ hoạ" } else { $row.label }
        [void]$detail.Add("${lineLabel}: $($row.value)")
      }
    }
    else {
      [void]$detail.Add("CPU: $cpu")
      [void]$detail.Add("RAM: $ram")
      [void]$detail.Add("Lưu trữ: $storage")
      [void]$detail.Add("Card đồ hoạ: $gpu")
      [void]$detail.Add("Màn hình: $screen")
      [void]$detail.Add("Pin: $battery")
      [void]$detail.Add("Camera: $camera")
      [void]$detail.Add("Hệ điều hành: $operatingSystem")
    }

    [void]$detail.Add("SKU: $sku")
    [void]$detail.Add("Barcode: $barcode")
    [void]$detail.Add("Bảo hành: $warrantyText")
  }

  return @{
    cpu = $cpu
    ram = $ram
    storage = $storage
    gpu = $gpu
    screen = $screen
    battery = $battery
    camera = $camera
    operatingSystem = $operatingSystem
    quickSpecs = ($quick -join "`n")
    detailSpecs = ($detail -join "`n")
  }
}

Write-Step "Dang dang nhap API..."
$login = Invoke-Json -Method Post -Uri "$BaseUrl/api/auth/login" -Body @{
  username = $Username
  password = $Password
}
if ([string]::IsNullOrWhiteSpace($login.token)) {
  throw "Dang nhap that bai."
}
$headers = @{ Authorization = "Bearer $($login.token)" }

Write-Step "Dang tai danh sach san pham hien tai..."
$localProducts = @((Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/public/products") | ForEach-Object { $_ })
if ($localProducts.Count -eq 0) {
  throw "Khong tim thay san pham."
}

$categoryMeta = @(
  [pscustomobject]@{
    name = "Laptop"
    description = "Laptop gaming, office, ultrabook"
    specProfile = "Laptop"
    handles = @("laptop")
  },
  [pscustomobject]@{
    name = "Bàn phím"
    description = "Ban phim co, gaming, van phong"
    specProfile = "Ban phim"
    handles = @("ban-phim-may-tinh")
  },
  [pscustomobject]@{
    name = "Chuột"
    description = "Chuot gaming, cong thai hoc, wireless"
    specProfile = "Phu kien"
    handles = @("chuot-may-tinh")
  },
  [pscustomobject]@{
    name = "Tai nghe"
    description = "Tai nghe gaming, Bluetooth, studio"
    specProfile = "Tai nghe"
    handles = @("tai-nghe-may-tinh")
  },
  [pscustomobject]@{
    name = "Màn hình"
    description = "Man hinh gaming, do hoa, van phong"
    specProfile = "Phu kien"
    handles = @("man-hinh", "man-hinh-do-hoa")
  },
  [pscustomobject]@{
    name = "Linh kiện PC"
    description = "CPU, VGA, RAM, mainboard, SSD"
    specProfile = "Phu kien"
    handles = @("linh-kien-may-tinh", "card-man-hinh-vga", "cpu-bo-vi-xu-ly", "linh-kien-phu-kien-laptop")
  },
  [pscustomobject]@{
    name = "Thiết bị mạng"
    description = "Router, mesh, access point"
    specProfile = "Phu kien"
    handles = @("thiet-bi-mang")
  },
  [pscustomobject]@{
    name = "Phụ kiện"
    description = "Cap, dock, hub, pin du phong, loa"
    specProfile = "Phu kien"
    handles = @("phu-kien", "microphone", "sac-du-phong")
  }
)

Write-Step "Dang dong bo danh muc theo bo du lieu GearVN..."
$existingCategories = @((Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/public/categories") | ForEach-Object { $_ })
foreach ($meta in $categoryMeta) {
  $key = Normalize-Key $meta.name
  $found = @($existingCategories | Where-Object { (Normalize-Key $_.name) -eq $key } | Select-Object -First 1)
  if ($found.Count -gt 0) {
    continue
  }

  try {
    $created = Invoke-Json -Method Post -Uri "$BaseUrl/api/admin/categories" -Headers $headers -Body @{
      name = [string]$meta.name
      description = [string]$meta.description
    }
    if ($null -ne $created) {
      $existingCategories += $created
      Write-Step "Da tao danh muc [$($meta.name)]"
    }
  }
  catch {
    Write-Step "Khong tao duoc danh muc [$($meta.name)] (co the da ton tai)."
  }
}

$existingCategories = @((Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/public/categories") | ForEach-Object { $_ })

$gearCache = @{}

foreach ($meta in $categoryMeta) {
  $matchedCategory = @($existingCategories | Where-Object { (Normalize-Key $_.name) -eq (Normalize-Key $meta.name) } | Select-Object -First 1)
  if ($matchedCategory.Count -eq 0) {
    Write-Step "Khong tim thay category [$($meta.name)] tren he thong, bo qua."
    continue
  }

  $catId = [int]$matchedCategory[0].id
  $localItems = @($localProducts | Where-Object { [int]$_.category.id -eq $catId } | Sort-Object id)
  if ($localItems.Count -eq 0) {
    Write-Step "Danh muc [$($meta.name)] chua co san pham seed, bo qua."
    continue
  }

  $categoryName = [string]$meta.specProfile
  $handles = @($meta.handles)
  $keywordFilters = @()
  if ($null -ne $meta.PSObject.Properties["keywords"]) {
    $keywordFilters = @($meta.keywords | ForEach-Object { Normalize-Key ([string]$_) } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  }
  $targetCount = $localItems.Count

  Write-Step "Lay du lieu GearVN cho [$($meta.name)]..."
  $selected = New-Object System.Collections.Generic.List[object]
  $seen = New-Object "System.Collections.Generic.HashSet[string]"

  foreach ($h in $handles) {
    if (-not $gearCache.ContainsKey($h)) {
      $gearCache[$h] = @(Get-CollectionProducts -Handle $h -MaxCount 1000)
    }

    foreach ($gp in $gearCache[$h]) {
      if ($keywordFilters.Count -gt 0) {
        $searchRaw = "{0} {1} {2} {3}" -f [string]$gp.title, [string]$gp.product_type, [string]$gp.vendor, [string]$gp.tags
        $searchKey = Normalize-Key $searchRaw
        $matchedKeyword = $false
        foreach ($kw in $keywordFilters) {
          if ($searchKey.Contains($kw)) {
            $matchedKeyword = $true
            break
          }
        }
        if (-not $matchedKeyword) {
          continue
        }
      }

      $k = [string]$gp.id
      if ($seen.Add($k)) {
        $selected.Add($gp)
      }
      if ($selected.Count -ge $targetCount) {
        break
      }
    }

    if ($selected.Count -ge $targetCount) {
      break
    }
  }

  if ($selected.Count -eq 0) {
    Write-Step "Khong co du lieu cho [$categoryName], bo qua."
    continue
  }

  if ($selected.Count -lt $targetCount) {
    $base = @($selected.ToArray())
    if ($base.Count -eq 0) {
      Write-Step "Khong co du lieu fallback cho [$categoryName], bo qua."
      continue
    }
    $idx = 0
    while ($selected.Count -lt $targetCount) {
      $selected.Add($base[$idx % $base.Count])
      $idx += 1
    }
  }

  $updated = 0
  for ($i = 0; $i -lt $localItems.Count; $i++) {
    $local = $localItems[$i]
    $gear = $selected[$i]

    $images = New-Object System.Collections.Generic.List[string]
    if ($null -ne $gear.images) {
      foreach ($img in $gear.images) {
        if ($null -ne $img.src) {
          $src = Normalize-Text $img.src
          if (-not [string]::IsNullOrWhiteSpace($src)) {
            $images.Add($src)
          }
        }
      }
    }
    if ($images.Count -eq 0 -and $null -ne $gear.image -and $null -ne $gear.image.src) {
      $single = Normalize-Text $gear.image.src
      if (-not [string]::IsNullOrWhiteSpace($single)) {
        $images.Add($single)
      }
    }
    if ($images.Count -eq 0) {
      continue
    }

    $variant = $null
    if ($null -ne $gear.variants -and $gear.variants.Count -gt 0) {
      $variant = $gear.variants[0]
    }

    $price = 0
    if ($null -ne $variant -and $null -ne $variant.price) {
      [void][decimal]::TryParse([string]$variant.price, [ref]$price)
    }
    if ($price -le 0 -and $null -ne $variant -and $null -ne $variant.compare_at_price) {
      [void][decimal]::TryParse([string]$variant.compare_at_price, [ref]$price)
    }
    if ($price -le 0) {
      $price = if ($null -ne $local.price) { [decimal]$local.price } else { 990000 }
    }

    $comparePrice = 0
    if ($null -ne $variant -and $null -ne $variant.compare_at_price) {
      [void][decimal]::TryParse([string]$variant.compare_at_price, [ref]$comparePrice)
    }
    $discountPercent = 0
    if ($comparePrice -gt $price -and $comparePrice -gt 0) {
      $discountPercent = [math]::Round((($comparePrice - $price) * 100 / $comparePrice), 2)
    }

    $stock = 20
    if ($null -ne $variant -and $null -ne $variant.inventory_quantity) {
      $inv = 0
      [void][int]::TryParse([string]$variant.inventory_quantity, [ref]$inv)
      if ($inv -gt 0) {
        $stock = $inv
      }
    }

    $specs = Build-Specs -Product $gear -CategoryName $categoryName
    $uniqueImages = @($images | Select-Object -Unique | Select-Object -First 8)

    $payload = @{
      id = $local.id
      version = $local.version
      name = (Normalize-Text $gear.title)
      description = (Build-Description -Product $gear)
      price = [decimal]$price
      discountPercent = [decimal]$discountPercent
      stock = [int]$stock
      imageUrl = $uniqueImages[0]
      galleryImages = ($uniqueImages -join "`n")
      quickSpecs = $specs.quickSpecs
      detailSpecs = $specs.detailSpecs
      cpu = $specs.cpu
      ram = $specs.ram
      storage = $specs.storage
      gpu = $specs.gpu
      screen = $specs.screen
      battery = $specs.battery
      camera = $specs.camera
      operatingSystem = $specs.operatingSystem
      category = @{
        id = $catId
      }
    }

    [void](Invoke-Json -Method Put -Uri "$BaseUrl/api/admin/products/$($local.id)" -Headers $headers -Body $payload)
    $updated += 1
  }

  Write-Step "Da cap nhat $updated/$($localItems.Count) cho [$categoryName]."
}

Write-Step "Hoan tat import."
