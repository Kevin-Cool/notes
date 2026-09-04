$ErrorActionPreference = "Stop"

$androidRoot = Join-Path $PSScriptRoot "../src-tauri/gen/android"
$gradleFile = Join-Path $androidRoot "app/build.gradle.kts"

# ------------------------------------------------------------
# Ensure Android project exists
# ------------------------------------------------------------

if (-not (Test-Path $gradleFile)) {
    Write-Host "Android project not initialized. Running Tauri Android init..."

    npm run tauri android init

    if (-not (Test-Path $gradleFile)) {
        throw "Tauri Android initialization did not create: $gradleFile"
    }
}

# ------------------------------------------------------------
# Ensure release signing patch exists
# ------------------------------------------------------------

$gradleContent = Get-Content $gradleFile -Raw

$signingMarker = "// NOTES_ANDROID_SIGNING"

if (-not $gradleContent.Contains($signingMarker)) {
    Write-Host "Adding Android release signing configuration..."

    # Add Properties import if missing
    if (-not $gradleContent.Contains("import java.util.Properties")) {
        $gradleContent =
            "import java.util.Properties`r`n" +
            $gradleContent
    }

    $signingBlock = @'
    // NOTES_ANDROID_SIGNING
    signingConfigs {
        create("release") {
            val signingPassword: String? =
                System.getenv("NOTES_SIGNING_PASSWORD")

            val signingKeyStore: String? =
                System.getenv("NOTES_KEYSTORE_PATH")

            if (signingPassword != null && signingKeyStore != null) {
                keyAlias = "notes"
                storeFile = file(signingKeyStore)

                storePassword = signingPassword
                keyPassword = signingPassword
            }
        }
    }

'@

    $buildTypesMarker = "    buildTypes {"

    if (-not $gradleContent.Contains($buildTypesMarker)) {
        throw "Could not find buildTypes block in generated Android Gradle file."
    }

    $gradleContent =
        $gradleContent.Replace(
            $buildTypesMarker,
            $signingBlock + $buildTypesMarker
        )

    # Add signingConfig to release build type
    $releaseMarker = @'
        getByName("release") {
'@

    $releaseReplacement = @'
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
'@

    if (-not $gradleContent.Contains($releaseMarker)) {
        throw "Could not find release build type in generated Android Gradle file."
    }

    $gradleContent =
        $gradleContent.Replace(
            $releaseMarker,
            $releaseReplacement
        )

    Set-Content $gradleFile $gradleContent -NoNewline
}

# ------------------------------------------------------------
# Resolve keystore
# ------------------------------------------------------------

[string]$keystorePath = $env:NOTES_KEYSTORE_PATH

if ([string]::IsNullOrWhiteSpace($keystorePath)) {
    $keystorePath = Read-Host "Path to Android signing keystore"
}

# Normalize pasted paths:
# - remove surrounding whitespace
# - remove surrounding " or '
# This supports Windows "Copy as path", which includes quotes.
$keystorePath = $keystorePath.Trim()

if (
    ($keystorePath.StartsWith('"') -and $keystorePath.EndsWith('"')) -or
    ($keystorePath.StartsWith("'") -and $keystorePath.EndsWith("'"))
) {
    $keystorePath = $keystorePath.Substring(
        1,
        $keystorePath.Length - 2
    )
}

$keystorePath = $keystorePath.Trim()

if ([string]::IsNullOrWhiteSpace($keystorePath)) {
    throw "No Android signing keystore was provided."
}

if (-not (Test-Path -LiteralPath $keystorePath -PathType Leaf)) {
    throw "Keystore does not exist: $keystorePath"
}

[string]$resolvedKeystorePath =
    (Resolve-Path -LiteralPath $keystorePath).Path

$env:NOTES_KEYSTORE_PATH = $resolvedKeystorePath

# ------------------------------------------------------------
# Ask for signing password
# ------------------------------------------------------------

[SecureString]$securePassword =
    Read-Host "Enter Android signing password" -AsSecureString

[IntPtr]$bstr =
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR(
        $securePassword
    )

[string]$plainPassword =
    [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR(
        $bstr
    )

try {
    $env:NOTES_SIGNING_PASSWORD = $plainPassword

    npm run tauri android build -- --apk

    if ($LASTEXITCODE -ne 0) {
        throw "Android build failed with exit code $LASTEXITCODE."
    }
}
finally {
    Remove-Item Env:NOTES_SIGNING_PASSWORD `
        -ErrorAction SilentlyContinue

    if ($bstr -ne [IntPtr]::Zero) {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR(
            $bstr
        )
    }

    $plainPassword = ""
}