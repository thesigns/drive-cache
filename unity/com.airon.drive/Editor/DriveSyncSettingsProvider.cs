using UnityEditor;
using UnityEngine;

namespace Airon.Drive
{
    public class DriveSyncSettingsProvider : SettingsProvider
    {
        private DriveSyncSettings _settings;

        public DriveSyncSettingsProvider()
            : base("Project/Drive Sync", SettingsScope.Project) { }

        public override void OnActivate(string searchContext, UnityEngine.UIElements.VisualElement rootElement)
        {
            _settings = DriveSyncSettings.Load();
        }

        public override void OnGUI(string searchContext)
        {
            EditorGUILayout.Space(10);

            EditorGUI.BeginChangeCheck();

            _settings.serverUrl = EditorGUILayout.TextField("Server URL", _settings.serverUrl);
            _settings.apiKey = EditorGUILayout.PasswordField("API Key", _settings.apiKey);
            _settings.resourceDir = EditorGUILayout.TextField("Resource Directory", _settings.resourceDir);

            if (EditorGUI.EndChangeCheck())
                DriveSyncSettings.Save();

            EditorGUILayout.Space(10);

            var cache = DriveSyncSettings.LoadCache();
            EditorGUI.BeginDisabledGroup(true);
            EditorGUILayout.IntField("Last Synced Version", cache.lastSyncedVersion);
            EditorGUILayout.IntField("Cached Assets", cache.assets.Count);
            EditorGUI.EndDisabledGroup();

            EditorGUILayout.Space(10);

            using (new EditorGUI.DisabledScope(!_settings.IsValid || DriveSyncRunner.IsSyncing))
            {
                if (GUILayout.Button("Sync Now", GUILayout.Height(30)))
                    DriveSyncRunner.RunSync(force: true);
            }

            if (DriveSyncRunner.IsSyncing)
                EditorGUILayout.HelpBox("Sync in progress...", MessageType.Info);
        }

        [SettingsProvider]
        public static SettingsProvider CreateProvider()
        {
            return new DriveSyncSettingsProvider
            {
                keywords = new[] { "drive", "sync", "google", "cache" }
            };
        }
    }
}
