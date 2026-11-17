"""Build the static program catalogue from the school workbook.

Source: data/gzgj-professional-system.xlsx
Output: js/programs-data.js and data/programs-summary.json

This script does not alter the source workbook. All 567 course rows, 75
enrolment-plan rows, 56 major detail rows and 134 source rows are preserved.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "gzgj-professional-system.xlsx"
JS_OUT = ROOT / "js" / "programs-data.js"
SUMMARY_OUT = ROOT / "data" / "programs-summary.json"


def clean(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\r\n", "\n").replace("\r", "\n").strip()
    return text


def is_pending(value: str) -> bool:
    return not value or value.startswith("暂无公开资料")


def source_refs(value: str) -> list[str]:
    return sorted(set(re.findall(r"S\d+", value or "")), key=lambda item: int(item[1:]))


def main() -> None:
    wb = load_workbook(SOURCE, data_only=True)
    arch_rows = list(wb["学院专业架构"].iter_rows(min_row=2, values_only=True))
    course_rows = list(wb["专业课程总表"].iter_rows(min_row=2, values_only=True))
    detail_rows = list(wb["专业详细介绍"].iter_rows(min_row=2, values_only=True))
    dept_rows = list(wb["专业系汇总"].iter_rows(min_row=2, values_only=True))
    source_rows = list(wb["信息来源与核验"].iter_rows(min_row=2, values_only=True))
    note_rows = list(wb["数据说明与统计"].iter_rows(min_row=2, values_only=True))

    # Departments: keep the six teaching units in the summary sheet. The
    # "合计" row is retained as workbook_summary, not as a department.
    dept_records = [row for row in dept_rows if clean(row[0]) != "合计" and clean(row[1])]
    dept_id_by_name: dict[str, str] = {}
    departments: list[dict[str, Any]] = []
    for index, row in enumerate(dept_records, start=1):
        dep_name = clean(row[1])
        dep_id = f"dept-{index:02d}"
        dept_id_by_name[dep_name] = dep_id
        departments.append({
            "id": dep_id,
            "seq": clean(row[0]),
            "name": dep_name,
            "kind": "人文素养学院" if "人文素养" in dep_name else "产业系",
            "summary": clean(row[8]),
            "rawGroupCount": clean(row[2]),
            "rawMajorCount": clean(row[3]),
            "rawCourseCount": clean(row[4]),
            "rawActiveCount": clean(row[5]),
            "rawHistoryCount": clean(row[6]),
            "rawGroupNames": clean(row[7]),
            "groupIds": [],
            "majorIds": [],
            "sourceIds": [],
        })

    group_id_by_key: dict[tuple[str, str], str] = {}
    groups: list[dict[str, Any]] = []
    for row in arch_rows:
        dep_name = clean(row[2])
        group_name = clean(row[3])
        if not dep_name or not group_name:
            continue
        key = (dep_name, group_name)
        if key in group_id_by_key:
            continue
        dep_id = dept_id_by_name.get(dep_name)
        if not dep_id:
            continue
        group_id = f"group-{len(groups) + 1:02d}"
        group_id_by_key[key] = group_id
        kind = "学科组" if "学科组" in group_name else ("未归组" if "未纳入" in group_name else "专业群")
        groups.append({
            "id": group_id,
            "deptId": dep_id,
            "name": group_name,
            "kind": kind,
            "majorIds": [],
            "sourceIds": [],
        })
        next(item for item in departments if item["id"] == dep_id)["groupIds"].append(group_id)

    plan_id_by_major: dict[tuple[str, str], list[str]] = {}
    plans: list[dict[str, Any]] = []
    major_id_by_key: dict[tuple[str, str], str] = {}
    majors: list[dict[str, Any]] = []
    for detail_index, row in enumerate(detail_rows, start=1):
        dep_name = clean(row[2])
        major_name = clean(row[1])
        group_name = clean(row[3])
        dep_id = dept_id_by_name.get(dep_name)
        group_id = group_id_by_key.get((dep_name, group_name))
        if not dep_id or not group_id or not major_name:
            continue
        major_id = f"major-{detail_index:03d}"
        major_id_by_key[(dep_name, major_name)] = major_id
        source_ids = source_refs(clean(row[12]))
        majors.append({
            "id": major_id,
            "seq": clean(row[0]),
            "deptId": dep_id,
            "groupId": group_id,
            "name": major_name,
            "isPublicFoundation": major_name.startswith("公共基础课程"),
            "trainingGoal": clean(row[4]),
            "coreAbilities": clean(row[5]),
            "employment": clean(row[6]),
            "enrollment": clean(row[7]),
            "duration": clean(row[8]),
            "mainCoursesSummary": clean(row[9]),
            "dataYear": clean(row[10]),
            "status": clean(row[11]),
            "sourceRaw": clean(row[12]),
            "sourceIds": source_ids,
            "planIds": [],
            "courseIds": [],
        })
        next(item for item in groups if item["id"] == group_id)["majorIds"].append(major_id)
        next(item for item in departments if item["id"] == dep_id)["majorIds"].append(major_id)

    # Enrolment plans: one row = one admission plan / level. Keep every row.
    for row in arch_rows:
        dep_name = clean(row[2])
        major_name = clean(row[4])
        group_name = clean(row[3])
        key = (dep_name, major_name)
        major_id = major_id_by_key.get(key)
        if not major_id:
            continue
        plan_id = f"plan-{len(plans) + 1:03d}"
        plan = {
            "id": plan_id,
            "seq": clean(row[0]),
            "majorId": major_id,
            "deptId": dept_id_by_name.get(dep_name, ""),
            "groupId": group_id_by_key.get((dep_name, group_name), ""),
            "college": clean(row[1]),
            "code": clean(row[5]),
            "level": clean(row[6]),
            "duration": clean(row[7]),
            "target": clean(row[8]),
            "campus": clean(row[9]),
            "status": clean(row[10]),
            "dataYear": clean(row[11]),
            "groupVerification": clean(row[12]),
            "note": clean(row[13]),
            "isActive2026": "在招" in clean(row[10]),
        }
        plans.append(plan)
        next(item for item in majors if item["id"] == major_id)["planIds"].append(plan_id)

    # Courses: every row is a distinct course offering record. IDs are stable
    # and never derived from course names (names may repeat across years).
    courses: list[dict[str, Any]] = []
    for index, row in enumerate(course_rows, start=1):
        dep_name = clean(row[1])
        group_name = clean(row[2])
        major_name = clean(row[3])
        major_id = major_id_by_key.get((dep_name, major_name))
        if not major_id:
            continue
        name = clean(row[6])
        intro = clean(row[7])
        category = clean(row[4])
        phase = clean(row[5])
        refs = source_refs(clean(row[9]))
        record_type = "course"
        if category in ("课程体系说明", "暂无公开资料") or not name:
            record_type = "note"
        course = {
            "id": f"course-{index:04d}",
            "seq": clean(row[0]),
            "deptId": dept_id_by_name.get(dep_name, ""),
            "groupId": group_id_by_key.get((dep_name, group_name), ""),
            "majorId": major_id,
            "name": name,
            "displayName": name if name and name != "暂无公开资料" else f"未命名 / 占位课程（原表第 {clean(row[0])} 行）",
            "category": category,
            "phase": phase,
            "intro": intro,
            "hasOfficialIntro": not is_pending(intro),
            "dataYear": clean(row[8]),
            "sourceRaw": clean(row[9]),
            "sourceIds": refs,
            "recordType": record_type,
            "needsWork": is_pending(intro) or record_type == "note",
        }
        courses.append(course)
        next(item for item in majors if item["id"] == major_id)["courseIds"].append(course["id"])

    # Sources: preserve all rows, including those not referenced by a course.
    sources: list[dict[str, Any]] = []
    for row in source_rows:
        seq = clean(row[0])
        if not seq.isdigit():
            continue
        sources.append({
            "id": f"S{seq}",
            "seq": int(seq),
            "dept": clean(row[1]),
            "major": clean(row[2]),
            "info": clean(row[3]),
            "title": clean(row[4]),
            "url": clean(row[5]),
            "published": clean(row[6]),
            "status": clean(row[7]),
        })

    # Aggregate source references at the department/group level for the
    # overview pages, without changing any source row.
    for dep in departments:
        dep_sources = [s for s in sources if s["dept"] == dep["name"]]
        dep["sourceIds"] = [s["id"] for s in dep_sources]
    for group in groups:
        dep_name = next(d["name"] for d in departments if d["id"] == group["deptId"])
        group_sources = [s for s in sources if s["dept"] == dep_name and any(
            major["id"] == group_major_id and major["name"] == s["major"]
            for group_major_id in group["majorIds"]
            for major in majors
        )]
        group["sourceIds"] = [s["id"] for s in group_sources]

    total_row = next((row for row in dept_rows if clean(row[0]) == "合计"), None)
    notes: list[dict[str, str]] = []
    for row in note_rows:
        title = clean(row[0])
        text = clean(row[1]) if len(row) > 1 else ""
        if title and text:
            notes.append({"title": title, "text": text})

    unique_course_names = {course["name"] for course in courses if course["name"]}
    stats = {
        "departments": len(departments),
        "groups": len(groups),
        "majors": len(majors),
        "plans": len(plans),
        "courses": len(courses),
        "uniqueCourseNames": len(unique_course_names),
        "officialCourseIntros": sum(1 for course in courses if course["hasOfficialIntro"]),
        "placeholderCourseRows": sum(1 for course in courses if course["needsWork"]),
        "sources": len(sources),
        "activePlans2026": sum(1 for plan in plans if plan["isActive2026"]),
        "majorDetailGaps": sum(
            1 for major in majors
            if is_pending(major["trainingGoal"]) or is_pending(major["coreAbilities"]) or is_pending(major["employment"])
        ),
    }

    workbook_summary = None
    if total_row:
        workbook_summary = {
            "units": clean(total_row[1]),
            "groups": clean(total_row[2]),
            "majors": clean(total_row[3]),
            "courses": clean(total_row[4]),
            "activeMajors": clean(total_row[5]),
            "historyMajors": clean(total_row[6]),
            "groupNames": clean(total_row[7]),
            "note": clean(total_row[8]),
        }

    data = {
        "meta": {
            "college": "广州市技师学院",
            "title": "广州市技师学院专业体系数据库",
            "version": "2026.11",
            "generatedAt": "2026-11-17",
            "sourceFile": "data/gzgj-professional-system.xlsx",
            "sourceSheets": wb.sheetnames,
            "dataNote": "数据来自上传的《广州市技师学院专业体系数据库.xlsx》。原表中的“暂无公开资料”“—”“推定”等状态均原样保留，不臆造学校未公开的信息。",
            "counts": stats,
            "workbookSummary": workbook_summary,
        },
        "departments": departments,
        "groups": groups,
        "majors": majors,
        "plans": plans,
        "courses": courses,
        "sources": sources,
        "notes": notes,
    }

    JS_OUT.write_text(
        "/* Generated from data/gzgj-professional-system.xlsx by tools/generate_programs_data.py. */\n"
        "export const PROGRAM_DATA = "
        + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        + ";\nexport default PROGRAM_DATA;\n",
        encoding="utf-8",
    )
    SUMMARY_OUT.write_text(json.dumps({
        "meta": data["meta"],
        "departmentCounts": [
            {"name": dep["name"], "groups": len(dep["groupIds"]), "majors": len(dep["majorIds"]), "sources": len(dep["sourceIds"])}
            for dep in departments
        ],
        "groupCounts": [
            {"name": group["name"], "dept": next(d["name"] for d in departments if d["id"] == group["deptId"]), "majors": len(group["majorIds"])}
            for group in groups
        ],
        "courseCategories": {
            category: sum(1 for course in courses if course["category"] == category)
            for category in sorted({course["category"] for course in courses})
        },
        "sampleCoursesWithOfficialIntro": [
            {"id": course["id"], "name": course["name"], "majorId": course["majorId"], "intro": course["intro"]}
            for course in courses if course["hasOfficialIntro"]
        ][:20],
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({
        "source": str(SOURCE),
        "js": str(JS_OUT),
        "bytes": JS_OUT.stat().st_size,
        "stats": stats,
        "groupCount": len(groups),
        "departmentCount": len(departments),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()