# Build Matayia's Welfare APK using only an Android phone

This project includes a GitHub Actions workflow. The actual Android build happens in GitHub's cloud, so a computer is not required.

## Phone-only method

1. Create a GitHub account if you do not already have one.
2. In Chrome on your phone, create a new GitHub repository named `matayias-welfare`.
3. Upload the contents of this project to the repository, keeping the `.github/workflows/build-android.yml` file in place.
4. Make sure the default branch is `main`.
5. Open the repository and tap **Actions**.
6. Select **Build Matayia's Welfare APK**.
7. Tap **Run workflow** if it has not already started.
8. Wait for the workflow to finish successfully.
9. Open the completed workflow run and download the **Matayias-Welfare-APK** artifact.
10. Extract the downloaded artifact and install `app-debug.apk` on the Android phone.

The APK is a debug/test APK. It is suitable for testing on the phone. A signed release APK/AAB can be prepared later when the app is ready for wider distribution or Google Play.
