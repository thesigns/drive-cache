using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace Airon.Drive
{
    [Serializable]
    public class ManifestAsset
    {
        public string filename;
        public string type;
        public string hash;
        public long size;
        public string modifiedTime;
        public string url;
    }

    public struct ManifestResponse
    {
        public int version;
        public Dictionary<string, ManifestAsset> assets;
    }

    public static class DriveSyncClient
    {
        public static async Task<int> FetchVersion(string serverUrl, string apiKey)
        {
            var url = serverUrl.TrimEnd('/') + "/manifest/version";
            var body = await SendGet(url, apiKey);
            // Response: {"version":123}
            var match = Regex.Match(body, @"""version""\s*:\s*(\d+)");
            if (match.Success && int.TryParse(match.Groups[1].Value, out var v))
                return v;
            throw new Exception($"[DriveSync] Failed to parse version from: {body}");
        }

        public static async Task<ManifestResponse> FetchManifest(string serverUrl, string apiKey)
        {
            var url = serverUrl.TrimEnd('/') + "/manifest";
            var body = await SendGet(url, apiKey);
            return ParseManifest(body);
        }

        public static async Task<byte[]> DownloadAsset(string serverUrl, string apiKey, string assetUrl)
        {
            var url = serverUrl.TrimEnd('/') + "/" + assetUrl.TrimStart('/');
            var request = UnityWebRequest.Get(url);
            request.SetRequestHeader("Authorization", "Bearer " + apiKey);
            await SendRequest(request);

            if (request.responseCode != 200)
                throw new Exception($"[DriveSync] Download failed ({request.responseCode}): {assetUrl}");

            return request.downloadHandler.data;
        }

        private static async Task<string> SendGet(string url, string apiKey)
        {
            var request = UnityWebRequest.Get(url);
            request.SetRequestHeader("Authorization", "Bearer " + apiKey);
            await SendRequest(request);

            if (request.responseCode != 200)
                throw new Exception($"[DriveSync] Request failed ({request.responseCode}): {url} — {request.downloadHandler.text}");

            return request.downloadHandler.text;
        }

        private static Task SendRequest(UnityWebRequest request)
        {
            var tcs = new TaskCompletionSource<bool>();
            var op = request.SendWebRequest();
            op.completed += _ => tcs.TrySetResult(true);
            return tcs.Task;
        }

        // --- Minimal JSON parser for manifest response ---
        // JsonUtility cannot deserialize Dictionary-keyed objects, so we parse manually.

        private static ManifestResponse ParseManifest(string json)
        {
            var result = new ManifestResponse { assets = new Dictionary<string, ManifestAsset>() };

            // Extract version
            var versionMatch = Regex.Match(json, @"""version""\s*:\s*(\d+)");
            if (versionMatch.Success)
                int.TryParse(versionMatch.Groups[1].Value, out result.version);

            // Find the "assets" object
            var assetsIdx = json.IndexOf("\"assets\"", StringComparison.Ordinal);
            if (assetsIdx < 0)
                return result;

            // Find the opening brace of the assets object
            var braceStart = json.IndexOf('{', assetsIdx + 8);
            if (braceStart < 0)
                return result;

            // Find matching closing brace
            var assetsBody = ExtractJsonObject(json, braceStart);
            if (assetsBody == null)
                return result;

            // Parse each top-level key in the assets object — these are fileIds
            var pos = 0;
            while (pos < assetsBody.Length)
            {
                // Find next key
                var keyStart = assetsBody.IndexOf('"', pos);
                if (keyStart < 0) break;
                var keyEnd = assetsBody.IndexOf('"', keyStart + 1);
                if (keyEnd < 0) break;
                var fileId = assetsBody.Substring(keyStart + 1, keyEnd - keyStart - 1);

                // Find the object for this key
                var objStart = assetsBody.IndexOf('{', keyEnd + 1);
                if (objStart < 0) break;
                var objBody = ExtractJsonObjectRaw(assetsBody, objStart);
                if (objBody == null) break;

                var asset = JsonUtility.FromJson<ManifestAsset>(objBody);
                if (asset != null)
                    result.assets[fileId] = asset;

                pos = objStart + objBody.Length;
            }

            return result;
        }

        private static string ExtractJsonObject(string json, int openBrace)
        {
            var raw = ExtractJsonObjectRaw(json, openBrace);
            if (raw == null || raw.Length < 2) return null;
            // Return inner content (without outer braces)
            return raw.Substring(1, raw.Length - 2);
        }

        private static string ExtractJsonObjectRaw(string json, int openBrace)
        {
            var depth = 0;
            var inString = false;
            var escape = false;
            for (var i = openBrace; i < json.Length; i++)
            {
                var c = json[i];
                if (escape) { escape = false; continue; }
                if (c == '\\' && inString) { escape = true; continue; }
                if (c == '"') { inString = !inString; continue; }
                if (inString) continue;
                if (c == '{') depth++;
                else if (c == '}') { depth--; if (depth == 0) return json.Substring(openBrace, i - openBrace + 1); }
            }
            return null;
        }
    }
}
