import java.util.Properties

val signingPassword: String? = System.getenv("NOTES_SIGNING_PASSWORD")
val signingKeyStore: String? = System.getenv("NOTES_KEYSTORE_PATH")

android {
    signingConfigs {
        create("release") {
            if (signingPassword != null && signingKeyStore != null) {
                keyAlias = "notes"
                storeFile = file(signingKeyStore)

                storePassword = signingPassword
                keyPassword = signingPassword
            }
        }
    }

    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}