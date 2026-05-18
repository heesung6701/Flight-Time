from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def cell_ref_to_indexes(ref: str) -> tuple[int, int]:
    match = re.match(r"([A-Z]+)(\d+)", ref)
    if not match:
        raise ValueError(f"Invalid cell reference: {ref}")
    column = 0
    for char in match.group(1):
        column = column * 26 + ord(char) - 64
    return int(match.group(2)) - 1, column - 1


def load_workbook(path: Path):
    archive = ZipFile(path)
    shared_strings: list[str] = []
    if "xl/sharedStrings.xml" in archive.namelist():
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        for item in root.findall("a:si", NS):
            shared_strings.append(
                "".join(
                    text.text or ""
                    for text in item.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
                )
            )

    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    relationship_targets = {rel.attrib["Id"]: rel.attrib["Target"] for rel in relationships}
    sheets: dict[str, str] = {}
    sheets_element = workbook.find("a:sheets", NS)
    if sheets_element is None:
        raise ValueError("Workbook has no sheets element")
    for sheet in sheets_element:
        relationship_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        target = relationship_targets[relationship_id]
        if target.startswith("/"):
            target = target[1:]
        elif not target.startswith("xl/"):
            target = f"xl/{target}"
        sheets[sheet.attrib["name"]] = target

    def cell_value(cell: ET.Element) -> str:
        cell_type = cell.attrib.get("t")
        if cell_type == "inlineStr":
            return "".join(
                text.text or ""
                for text in cell.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
            )
        value = cell.find("a:v", NS)
        if value is None:
            return ""
        raw = value.text or ""
        if cell_type == "s":
            return shared_strings[int(raw)]
        return raw

    def sheet_matrix(name: str) -> list[list[str]]:
        root = ET.fromstring(archive.read(sheets[name]))
        cells: dict[tuple[int, int], str] = {}
        max_row = 0
        max_column = 0
        for row in root.findall("a:sheetData/a:row", NS):
            for cell in row.findall("a:c", NS):
                row_index, column_index = cell_ref_to_indexes(cell.attrib["r"])
                cells[(row_index, column_index)] = cell_value(cell)
                max_row = max(max_row, row_index)
                max_column = max(max_column, column_index)
        return [
            [cells.get((row_index, column_index), "") for column_index in range(max_column + 1)]
            for row_index in range(max_row + 1)
        ]

    return sheet_matrix


def main() -> None:
    workbook_path = Path(sys.argv[1])
    sheet_names = sys.argv[2:]
    matrix_for = load_workbook(workbook_path)
    print(json.dumps({name: matrix_for(name) for name in sheet_names}, ensure_ascii=False))


if __name__ == "__main__":
    main()
