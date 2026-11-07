import glob
import json
from pathlib import Path

from graphify.cache import save_semantic_cache
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json
from graphify.diagnostics import diagnose_extraction, format_diagnostic_report


out = Path('graphify-out')
detect = json.loads((out / '.graphify_detect.json').read_text(encoding='utf-8'))
root = Path(detect['scan_root'])
ast = json.loads((out / '.graphify_ast.json').read_text(encoding='utf-8'))
chunks = [json.loads(Path(p).read_text(encoding='utf-8')) for p in sorted(glob.glob(str(out / '.graphify_chunk_*.json')))]
assert len(chunks) == 3, f'Expected 3 chunks; found {len(chunks)}'
expected = set((out / '.graphify_uncached.txt').read_text(encoding='utf-8').splitlines())
coverage = {}
for chunk in chunks:
    assert isinstance(chunk.get('nodes'), list) and isinstance(chunk.get('edges'), list)
    coverage.update(chunk.get('coverage', {}))
assert set(coverage) == expected, f'Coverage mismatch: {expected - set(coverage)}'
partial = []
for src, count in coverage.items():
    if Path(src).suffix.lower() in ('.jpg', '.jpeg', '.png', '.gif', '.webp'):
        continue
    actual = sum(1 for _ in Path(src).open(encoding='utf-8', errors='replace'))
    if int(count) < actual:
        partial.append((src, count, actual))
assert not partial, f'Partial semantic reads: {partial}'
(out / '.graphify_partial.txt').write_text('', encoding='utf-8')

sem = {
    'nodes': [n for c in chunks for n in c['nodes']],
    'edges': [e for c in chunks for e in c['edges']],
    'hyperedges': [h for c in chunks for h in c.get('hyperedges', [])],
    'input_tokens': 0,
    'output_tokens': 0,
}
saved = save_semantic_cache(sem['nodes'], sem['edges'], sem['hyperedges'], root=root,
                            allowed_source_files=list(expected),
                            prompt_file='C:/Users/Janmari/.codex/skills/graphify/references/extraction-spec.md',
                            partial_source_files=[])
for n in sem['nodes']:
    n.setdefault('_origin', 'semantic')
for e in sem['edges']:
    e.setdefault('_origin', 'semantic')
seen = {n['id'] for n in ast['nodes']}
nodes = list(ast['nodes'])
for n in sem['nodes']:
    if n['id'] not in seen:
        nodes.append(n)
        seen.add(n['id'])
extraction = {
    'nodes': nodes,
    'edges': ast['edges'] + sem['edges'],
    'hyperedges': sem['hyperedges'],
    'input_tokens': 0,
    'output_tokens': 0,
}
(out / '.graphify_semantic.json').write_text(json.dumps(sem, indent=2, ensure_ascii=False), encoding='utf-8')
(out / '.graphify_extract.json').write_text(json.dumps(extraction, indent=2, ensure_ascii=False), encoding='utf-8')

G = build_from_json(extraction, root=root, directed=False)
assert G.number_of_nodes() > 0
communities = cluster(G)
cohesion = score_all(G, communities)
gods = god_nodes(G)
surprises = surprising_connections(G, communities)
labels = {cid: 'Community ' + str(cid) for cid in communities}
questions = suggest_questions(G, communities, labels)
assert to_json(G, communities, str(out / 'graph.json'))
report = generate(G, communities, cohesion, labels, gods, surprises, detect,
                  {'input': 0, 'output': 0}, str(root), suggested_questions=questions)
(out / 'GRAPH_REPORT.md').write_text(report, encoding='utf-8')
analysis = {'communities': {str(k): v for k, v in communities.items()},
            'cohesion': {str(k): v for k, v in cohesion.items()},
            'gods': gods, 'surprises': surprises, 'questions': questions}
(out / '.graphify_analysis.json').write_text(json.dumps(analysis, indent=2, ensure_ascii=False), encoding='utf-8')
health = diagnose_extraction(extraction, directed=False, root=root)
(out / '.graphify_health.json').write_text(json.dumps(health, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Coverage OK: {len(expected)} files; cached {saved}')
print(f'Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities')
print(format_diagnostic_report(health))
for cid, members in communities.items():
    ranked = sorted(members, key=lambda n: G.degree[n] if n in G else 0, reverse=True)[:6]
    names = [G.nodes[n].get('label', n) for n in ranked]
    print(f'COMMUNITY {cid} ({len(members)}): {names}')
