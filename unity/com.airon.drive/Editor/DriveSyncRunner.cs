using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;

namespace Airon.Drive
{
    [InitializeOnLoad]
    public static class DriveSyncRunner
    {
        private const string ResourceDir = "Assets/Resources/Drive";

        public static bool IsSyncing { get; private set; }

        static DriveSyncRunner()
        {
            EditorApplication.delayCall += () => RunSync(force: true);
            EditorApplication.playModeStateChanged += OnPlayModeChanged;
        }

        private static void OnPlayModeChanged(PlayModeStateChange state)
        {
            if (state == PlayModeStateChange.ExitingEditMode)
                RunSync(force: false);
        }

        public static async void RunSync(bool force)
        {
            var settings = DriveSyncSettings.Load();
            if (!settings.IsValid)
            {
                Debug.Log("[DriveSync] Skipped — configure Server URL and API Key in Project Settings > Drive Sync.");
                return;
            }

            if (IsSyncing)
            {
                Debug.Log("[DriveSync] Sync already in progress, skipping.");
                return;
            }

            IsSyncing = true;
            try
            {
                await RunSyncInternal(settings, force);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[DriveSync] Sync failed: {ex.Message}");
            }
            finally
            {
                IsSyncing = false;
            }
        }

        private static string ComputeMD5(string filePath)
        {
            using var md5 = MD5.Create();
            using var stream = File.OpenRead(filePath);
            var hashBytes = md5.ComputeHash(stream);
            return BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();
        }

        private static async Task RunSyncInternal(DriveSyncSettings settings, bool force)
        {
            var cache = DriveSyncSettings.LoadCache();
            var serverUrl = settings.serverUrl;
            var apiKey = settings.apiKey;

            // Version check — skip if up to date
            if (!force)
            {
                var remoteVersion = await DriveSyncClient.FetchVersion(serverUrl, apiKey);
                if (remoteVersion == cache.lastSyncedVersion)
                {
                    Debug.Log($"[DriveSync] Up to date (version {remoteVersion}).");
                    return;
                }
            }

            // Fetch full manifest
            var manifest = await DriveSyncClient.FetchManifest(serverUrl, apiKey);
            Debug.Log($"[DriveSync] Manifest version {manifest.version} — {manifest.assets.Count} asset(s).");

            var downloaded = 0;
            var skipped = 0;
            var deleted = 0;
            var newCacheAssets = new List<DriveSyncSettings.CachedAsset>();

            // Ensure output directory exists
            Directory.CreateDirectory(ResourceDir);

            // Download new/changed assets (compare MD5 of local file against manifest hash)
            var manifestFilenames = new HashSet<string>();
            foreach (var kvp in manifest.assets)
            {
                var fileId = kvp.Key;
                var asset = kvp.Value;
                var diskPath = Path.Combine(ResourceDir, asset.filename);
                manifestFilenames.Add(asset.filename);

                newCacheAssets.Add(new DriveSyncSettings.CachedAsset
                {
                    fileId = fileId,
                    hash = asset.hash,
                    filename = asset.filename
                });

                // Skip if file exists on disk with matching hash
                if (File.Exists(diskPath) && ComputeMD5(diskPath) == asset.hash)
                {
                    skipped++;
                    continue;
                }

                var data = await DriveSyncClient.DownloadAsset(serverUrl, apiKey, asset.url);
                var dir = Path.GetDirectoryName(diskPath);
                if (!string.IsNullOrEmpty(dir))
                    Directory.CreateDirectory(dir);
                File.WriteAllBytes(diskPath, data);
                downloaded++;
            }

            // Delete local files not present in manifest
            foreach (var filePath in Directory.GetFiles(ResourceDir, "*", SearchOption.AllDirectories))
            {
                if (filePath.EndsWith(".meta"))
                    continue;
                var relativePath = Path.GetRelativePath(ResourceDir, filePath).Replace('\\', '/');
                if (manifestFilenames.Contains(relativePath))
                    continue;

                File.Delete(filePath);
                var metaPath = filePath + ".meta";
                if (File.Exists(metaPath))
                    File.Delete(metaPath);
                deleted++;
            }

            // Save updated cache
            cache.lastSyncedVersion = manifest.version;
            cache.assets = newCacheAssets;
            DriveSyncSettings.SaveCache(cache);

            // Refresh asset database if anything changed
            if (downloaded > 0 || deleted > 0)
                AssetDatabase.Refresh();

            Debug.Log($"[DriveSync] Done — {downloaded} downloaded, {skipped} up-to-date, {deleted} deleted.");
        }
    }
}
