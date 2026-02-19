using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Airon.Drive
{
    [Serializable]
    public class DriveSyncSettings
    {
        private const string SettingsDir = "ProjectSettings/Packages/com.airon.drive";
        private const string SettingsPath = SettingsDir + "/Settings.json";

        public string serverUrl = "";
        public string apiKey = "";
        public string resourceDir = "Assets/Resources/Drive";

        private static DriveSyncSettings s_Instance;

        public static DriveSyncSettings Load()
        {
            if (s_Instance != null)
                return s_Instance;

            s_Instance = new DriveSyncSettings();
            if (File.Exists(SettingsPath))
            {
                var json = File.ReadAllText(SettingsPath);
                JsonUtility.FromJsonOverwrite(json, s_Instance);
            }
            return s_Instance;
        }

        public static void Save()
        {
            if (s_Instance == null)
                return;

            Directory.CreateDirectory(SettingsDir);
            File.WriteAllText(SettingsPath, JsonUtility.ToJson(s_Instance, true));
        }

        public bool IsValid => !string.IsNullOrEmpty(serverUrl) && !string.IsNullOrEmpty(apiKey);

        // --- Cache (in-memory only, rebuilds each editor session) ---

        public class CachedAsset
        {
            public string fileId;
            public string hash;
            public string filename;
        }

        public class SyncCache
        {
            public int lastSyncedVersion;
            public List<CachedAsset> assets = new List<CachedAsset>();
        }

        private static SyncCache s_Cache;

        public static SyncCache LoadCache()
        {
            s_Cache ??= new SyncCache();
            return s_Cache;
        }

        public static void SaveCache(SyncCache cache)
        {
            s_Cache = cache;
        }
    }
}
