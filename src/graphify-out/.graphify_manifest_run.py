import json
from datetime import datetime, timezone
from pathlib import Path
from graphify.detect import save_manifest
from graphify.cli import _stamped_manifest_files

out = Path('graphify-out')
detection = json.loads((out / '.graphify_detect.json').read_text(encoding='utf-8'))
extraction = json.loads((out / '.graphify_extract.json').read_text(encoding='utf-8'))
root = Path(detection['scan_root'])
corpus = detection.get('all_files') or detection['files']
partial = set((out / '.graphify_partial.txt').read_text(encoding='utf-8').splitlines())
manifest_files = _stamped_manifest_files(corpus, extraction, root, partial_source_files=partial)
dispatched = {f for t, files in detection['files'].items() if t in ('document', 'paper', 'image') for f in files}
stamped = {f for files in manifest_files.values() for f in files}
scan = {f for files in corpus.values() for f in files}
save_manifest(manifest_files, root=root, scan_corpus=scan, clear_semantic=(dispatched - stamped) or None)
cost_path = out / 'cost.json'
cost = json.loads(cost_path.read_text(encoding='utf-8')) if cost_path.exists() else {
    'runs': [], 'total_input_tokens': 0, 'total_output_tokens': 0}
cost['runs'].append({'date': datetime.now(timezone.utc).isoformat(), 'input_tokens': 0,
                     'output_tokens': 0, 'files': detection['total_files'],
                     'metering_note': 'Agent token usage unavailable; zero is recorded, not actual.'})
cost_path.write_text(json.dumps(cost, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Manifest saved: {sum(map(len, manifest_files.values()))} stamped files; {len(dispatched-stamped)} semantic files unstamped')
print('Token metering unavailable for semantic agents; 0 recorded input/output tokens')
