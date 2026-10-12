"""Compile the actual native service with a synthetic-input smoke harness (macOS 26+)."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
source = (root / 'apple/Go Search/Shared (Extension)/SafariWebExtensionHandler.swift').read_text()
harness = r'''
@main struct ModelSmoke {
    static func main() async {
        print("Model availability: \(await ShortcutIntelligence.shared.availability())")
        let result = await ShortcutIntelligence.shared.respond(to: ["type": "suggest-shortcuts", "sites": [
            ["index": 0, "host": "dash.cloudflare.com", "visits": 12, "days": 4],
            ["index": 1, "host": "en.wikipedia.org", "visits": 8, "days": 3]
        ]])
        let data = try! JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
        print(String(data: data, encoding: .utf8)!)
        let invalid = await ShortcutIntelligence.shared.respond(to: ["type": "suggest-shortcuts", "sites": [
            ["index": 0, "host": "https://example.com/?secret=test", "visits": 12, "days": 4]
        ]])
        if result["status"] as? String == "available" {
            precondition(!(result["labels"] as? [[String: Any]] ?? []).isEmpty)
            precondition(invalid["status"] as? String == "invalidInput")
            print("PASS: native structured generation and input rejection")
        } else {
            print("SKIP: model unavailable; fallback status returned")
        }
    }
}
'''
with tempfile.TemporaryDirectory(prefix='go-search-model-') as directory:
    source_path = Path(directory) / 'Smoke.swift'
    binary = Path(directory) / 'smoke'
    source_path.write_text(source + harness)
    subprocess.run(['xcrun', 'swiftc', '-parse-as-library', str(source_path), '-o', str(binary)], check=True)
    subprocess.run([str(binary)], check=True, timeout=60)
