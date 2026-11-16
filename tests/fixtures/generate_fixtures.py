"""Generate small, fictional fixtures for js/files.js browser tests.

No real student, teacher, or school data is used.

Run with the DSH bundled Python (includes python-docx, python-pptx, openpyxl):
    python tests/fixtures/generate_fixtures.py

The PDF fixtures are generated separately with Chromium; see docs/文件解析说明.md.
"""

from pathlib import Path

from docx import Document
from openpyxl import Workbook
from pptx import Presentation

OUT = Path(__file__).resolve().parent


def make_docx() -> None:
    doc = Document()
    doc.core_properties.title = "智能设备基础 · 文件解析测试"
    doc.core_properties.author = "匠备测试"
    doc.core_properties.subject = "DOCX 解析夹具"
    doc.core_properties.comments = "虚构测试材料，不含真实个人信息。"
    doc.core_properties.last_modified_by = "匠备测试"
    doc.add_heading("任务一：控制线路检查", level=1)
    doc.add_paragraph(
        "这是用于测试 DOCX 段落抽取的虚构文本，不包含真实个人信息。"
        "小组需要依据任务书完成检查，并记录结果。"
    )
    doc.add_heading("安全要求", level=2)
    doc.add_paragraph("操作前必须断电、验电，并由指导教师确认；发现异常立即停止。")
    table = doc.add_table(rows=2, cols=2)
    table.style = "Table Grid"
    table.cell(0, 0).text = "项目"
    table.cell(0, 1).text = "要求"
    table.cell(1, 0).text = "安全确认"
    table.cell(1, 1).text = "断电、验电、挂牌并互检"
    doc.save(OUT / "sample.docx")


def make_xlsx() -> None:
    wb = Workbook()
    wb.properties.title = "教学任务数据"
    wb.properties.creator = "匠备测试"
    wb.properties.subject = "XLSX 解析夹具"
    wb.properties.description = "虚构测试数据，不含真实个人信息。"
    wb.properties.lastModifiedBy = "匠备测试"
    ws = wb.active
    ws.title = "任务清单"
    ws.append(["序号", "任务名称", "建议学时"])
    ws.append([1, "控制线路检查", 4])
    ws.append([2, "PLC 联机调试", 6])
    ws2 = wb.create_sheet("分组建议")
    ws2.append(["组别", "人数", "工位"])
    ws2.append(["第 1 组", 5, "A-01"])
    ws2.append(["第 2 组", 6, "A-02"])
    wb.save(OUT / "sample.xlsx")


def make_pptx() -> None:
    prs = Presentation()
    prs.core_properties.title = "智能设备基础课件"
    prs.core_properties.author = "匠备测试"
    prs.core_properties.subject = "PPTX 解析夹具"
    prs.core_properties.comments = "虚构测试材料，不含真实个人信息。"
    prs.core_properties.last_modified_by = "匠备测试"

    slide = prs.slides.add_slide(prs.slide_layouts[0])
    slide.shapes.title.text = "智能设备基础"
    slide.placeholders[1].text = "文件解析测试 · 虚构课件"

    slide2 = prs.slides.add_slide(prs.slide_layouts[1])
    slide2.shapes.title.text = "任务流程"
    body = slide2.placeholders[1]
    body.text = "资讯"
    for line in ["计划", "实施", "检查", "评价"]:
        paragraph = body.text_frame.add_paragraph()
        paragraph.text = line

    prs.save(OUT / "sample.pptx")


if __name__ == "__main__":
    make_docx()
    make_xlsx()
    make_pptx()
    for name in ("sample.docx", "sample.xlsx", "sample.pptx"):
        path = OUT / name
        print(f"{name}: {path.stat().st_size} bytes")