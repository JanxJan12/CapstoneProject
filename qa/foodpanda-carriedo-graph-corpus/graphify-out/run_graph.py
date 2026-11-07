from __future__ import annotations

import json
import sys
from pathlib import Path

from graphify.detect import detect
from graphify.paths import out_path
from graphify.watch import _read_build_excludes, _read_build_gitignore


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "graphify-out"


def write(name: str, value: object) -> None:
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def read(name: str) -> dict:
    return json.loads((OUT / name).read_text(encoding="utf-8"))


if __name__ == "__main__":
    stage = sys.argv[1]
    if stage == "detect":
        result = detect(ROOT, extra_excludes=_read_build_excludes(out_path()), gitignore=_read_build_gitignore(out_path()))
        write(".graphify_detect.json", result)
        print(f"Detected {result['total_files']} files, {result['total_words']} words")
        print({kind: len(files) for kind, files in result["files"].items() if files})
    elif stage == "extract":
        from graphify.extract import extract

        detection = read(".graphify_detect.json")
        code = [Path(p) for p in detection["files"].get("code", [])]
        ast = extract(code, cache_root=ROOT, root=ROOT) if code else {"nodes": [], "edges": [], "input_tokens": 0, "output_tokens": 0}
        write(".graphify_ast.json", ast)
        sem = read(".graphify_semantic.json")
        for node in sem["nodes"]:
            node.setdefault("_origin", "semantic")
        for edge in sem["edges"]:
            edge.setdefault("_origin", "semantic")
        seen = {node["id"] for node in ast["nodes"]}
        nodes = list(ast["nodes"])
        for node in sem["nodes"]:
            if node["id"] not in seen:
                nodes.append(node)
                seen.add(node["id"])
        merged = {
            "nodes": nodes,
            "edges": ast["edges"] + sem["edges"],
            "hyperedges": sem.get("hyperedges", []),
            "input_tokens": sem.get("input_tokens", 0),
            "output_tokens": sem.get("output_tokens", 0),
        }
        write(".graphify_extract.json", merged)
        print(f"Merged {len(nodes)} nodes and {len(merged['edges'])} edges")
    elif stage == "build":
        from graphify.analyze import god_nodes, surprising_connections, suggest_questions
        from graphify.build import build_from_json
        from graphify.cluster import cluster, score_all
        from graphify.export import to_json
        from graphify.report import generate

        extraction = read(".graphify_extract.json")
        detection = read(".graphify_detect.json")
        graph = build_from_json(extraction, root=str(ROOT), directed=False)
        if graph.number_of_nodes() == 0:
            raise SystemExit("Empty graph; refusing to write outputs")
        communities = cluster(graph)
        cohesion = score_all(graph, communities)
        gods = god_nodes(graph)
        surprises = surprising_connections(graph, communities)
        labels = {cid: f"Community {cid}" for cid in communities}
        questions = suggest_questions(graph, communities, labels)
        tokens = {"input": extraction.get("input_tokens", 0), "output": extraction.get("output_tokens", 0)}
        if not to_json(graph, communities, str(OUT / "graph.json")):
            raise SystemExit("Graph shrink guard blocked write")
        report = generate(graph, communities, cohesion, labels, gods, surprises, detection, tokens, str(ROOT), suggested_questions=questions)
        (OUT / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
        write(".graphify_analysis.json", {"communities": communities, "cohesion": cohesion, "gods": gods, "surprises": surprises, "questions": questions})
        print(f"Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges, {len(communities)} communities")
    elif stage == "health":
        from graphify.diagnostics import diagnose_extraction, format_diagnostic_report

        summary = diagnose_extraction(read(".graphify_extract.json"), directed=False, root=str(ROOT))
        print(format_diagnostic_report(summary))
    elif stage == "label":
        from graphify.analyze import suggest_questions
        from graphify.build import build_from_json
        from graphify.export import to_json
        from graphify.report import generate

        extraction = read(".graphify_extract.json")
        detection = read(".graphify_detect.json")
        analysis = read(".graphify_analysis.json")
        graph = build_from_json(extraction, root=str(ROOT), directed=False)
        communities = {int(key): value for key, value in analysis["communities"].items()}
        cohesion = {int(key): value for key, value in analysis["cohesion"].items()}
        labels = {0: "Menu discovery and product choice", 1: "Source and evidence limits", 2: "Marketplace listing claims"}
        questions = suggest_questions(graph, communities, labels)
        tokens = {"input": extraction.get("input_tokens", 0), "output": extraction.get("output_tokens", 0)}
        report = generate(graph, communities, cohesion, labels, analysis["gods"], analysis["surprises"], detection, tokens, str(ROOT), suggested_questions=questions)
        report += "\nToken note: The collaboration tool did not expose subagent token usage; 0 above means unreported, not free.\n"
        (OUT / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
        write(".graphify_labels.json", {str(key): value for key, value in labels.items()})
        if not to_json(graph, communities, str(OUT / "graph.json"), community_labels=labels):
            raise SystemExit("Graph shrink guard blocked labeled export")
        print("Labeled three communities")
    elif stage == "finalize":
        from datetime import datetime, timezone

        from graphify.cli import _stamped_manifest_files
        from graphify.detect import save_manifest

        detection = read(".graphify_detect.json")
        extraction = read(".graphify_extract.json")
        corpus = detection.get("all_files") or detection["files"]
        stamped = _stamped_manifest_files(corpus, extraction, ROOT)
        scan = {file for files in corpus.values() for file in files}
        save_manifest(stamped, root=ROOT, scan_corpus=scan)
        cost = {
            "runs": [{
                "date": datetime.now(timezone.utc).isoformat(),
                "input_tokens": 0,
                "output_tokens": 0,
                "files": detection["total_files"],
                "note": "Subagent usage was not exposed by the collaboration tool; token count unreported.",
            }],
            "total_input_tokens": 0,
            "total_output_tokens": 0,
        }
        write("cost.json", cost)
        print("Manifest and unreported token-cost note saved")
    else:
        raise SystemExit(f"Unknown stage: {stage}")
